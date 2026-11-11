
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from mysql.connector import IntegrityError
from db import get_db_connection
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
CORS(
    app,
    supports_credentials=True,
    origins=["http://127.0.0.1:5500"]
)
app.secret_key = os.getenv("SECRET_KEY")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False


@app.route("/")
def home():
    return jsonify({"message": "CampusFix Backend is running!"})


@app.route("/api/test-db")
def test_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Database connected successfully!",
            "tables": [table[0] for table in tables]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT role_id FROM Roles WHERE role_name = %s",
            ("Student/Staff",)
        )
        role = cursor.fetchone()

        if not role:
            return jsonify({"error": "Default role not found"}), 500

        hashed_password = generate_password_hash(password)

        cursor.execute(
            """INSERT INTO Users
            (full_name, email, password_hash, role_id)
            VALUES (%s, %s, %s, %s)""",
            (name, email, hashed_password, role[0])
        )

        conn.commit()

        return jsonify({
            "message": "Registration successful!"
        }), 201

    except IntegrityError:
        conn.rollback()
        return jsonify({"error": "Email already registered"}), 409

    finally:
        cursor.close()
        conn.close()


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """SELECT u.user_id, u.full_name, u.email,
            u.password_hash, r.role_name
            FROM Users u
            JOIN Roles r ON u.role_id = r.role_id
            WHERE u.email = %s""",
            (email,)
        )

        user = cursor.fetchone()

        if not user or not check_password_hash(
            user["password_hash"], password
        ):
            return jsonify({"error": "Invalid email or password"}), 401

        session.clear()
        session["user_id"] = user["user_id"]
        session["role"] = user["role_name"]

        return jsonify({
            "message": "Login successful!",
            "user": {
                "user_id": user["user_id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user["role_name"]
            }
        })

    finally:
        cursor.close()
        conn.close()


@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    if "user_id" not in session:
        return jsonify({"error": "Please login first"}), 401
    if session.get("role") == "Maintenance Staff":
      return jsonify({"error": "Maintenance Staff cannot submit complaints"}), 403

    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    category = data.get("category", "").strip()
    location = data.get("location", "").strip()
    description = data.get("description", "").strip()

    if not all([title, category, location, description]):
        return jsonify({"error": "All fields are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT category_id FROM Categories WHERE category_name = %s",
            (category,)
        )
        result = cursor.fetchone()

        if not result:
            return jsonify({"error": "Invalid complaint category"}), 400

        category_id = result[0]
        user_id = session["user_id"]

        cursor.execute(
            """INSERT INTO Complaints
            (user_id, category_id, title, location, description)
            VALUES (%s, %s, %s, %s, %s)""",
            (user_id, category_id, title, location, description)
        )

        complaint_id = cursor.lastrowid

        cursor.execute(
            """INSERT INTO Status_History
            (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (%s, %s, %s, %s, %s)""",
            (complaint_id, user_id, None, "Submitted", "Complaint created")
        )

        cursor.execute(
            """INSERT INTO Activity_Logs
            (user_id, action, details)
            VALUES (%s, %s, %s)""",
            (user_id, "Complaint Submitted", title)
        )

        conn.commit()

        return jsonify({
            "message": "Complaint submitted successfully!",
            "complaint_id": complaint_id
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



@app.route("/api/complaints", methods=["GET"])
def get_complaints():
    if "user_id" not in session:
        return jsonify({"message": "Please login first"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    role = session["role"]
    user_id = session["user_id"]

    query = """
        SELECT
            c.complaint_id,
            c.title,
            c.location,
            c.description,
            c.status,
            c.created_at,
            cat.category_name,
            staff.full_name AS assigned_staff
        FROM Complaints c
        JOIN Categories cat
            ON c.category_id = cat.category_id
        LEFT JOIN Assignments a
            ON c.complaint_id = a.complaint_id
            AND a.is_active = 1
        LEFT JOIN Users staff
            ON a.staff_id = staff.user_id
    """

    if role == "Administrator":
        cursor.execute(query + " ORDER BY c.created_at DESC")

    elif role == "Maintenance Staff":
        cursor.execute(
            query + """
            WHERE a.staff_id = %s
            AND a.is_active = 1
            ORDER BY c.created_at DESC
            """,
            (user_id,)
        )

    else:
        cursor.execute(
            query + """
            WHERE c.user_id = %s
            ORDER BY c.created_at DESC
            """,
            (user_id,)
        )

    complaints = cursor.fetchall()

    cursor.close()
    conn.close()

    for complaint in complaints:
        if complaint["created_at"]:
            complaint["created_at"] = complaint["created_at"].isoformat()

    return jsonify(complaints), 200

@app.route("/api/complaints/<int:complaint_id>/assign", methods=["PUT"])
def assign_complaint(complaint_id):
    if "user_id" not in session:
        return jsonify({"error": "Please login first"}), 401

    if session.get("role") != "Administrator":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}
    staff_id = data.get("staff_id")

    if not staff_id:
        return jsonify({"error": "Staff ID is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """SELECT user_id FROM Users
            WHERE user_id = %s AND role_id = (
                SELECT role_id FROM Roles
                WHERE role_name = 'Maintenance Staff'
            )""",
            (staff_id,)
        )

        if not cursor.fetchone():
            return jsonify({"error": "Invalid maintenance staff"}), 400

        cursor.execute(
            "SELECT status FROM Complaints WHERE complaint_id = %s",
            (complaint_id,)
        )
        complaint = cursor.fetchone()

        if not complaint:
            return jsonify({"error": "Complaint not found"}), 404

        old_status = complaint[0]

        cursor.execute(
            """UPDATE Assignments SET is_active = FALSE
            WHERE complaint_id = %s AND is_active = TRUE""",
            (complaint_id,)
        )

        cursor.execute(
            """INSERT INTO Assignments
            (complaint_id, staff_id, assigned_by, is_active)
            VALUES (%s, %s, %s, TRUE)""",
            (complaint_id, staff_id, session["user_id"])
        )

        cursor.execute(
            """UPDATE Complaints
            SET status = 'Assigned'
            WHERE complaint_id = %s""",
            (complaint_id,)
        )

        cursor.execute(
            """INSERT INTO Status_History
            (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (%s, %s, %s, 'Assigned', 'Maintenance staff assigned')""",
            (complaint_id, session["user_id"], old_status)
        )

        cursor.execute(
            """INSERT INTO Activity_Logs
            (user_id, action, details)
            VALUES (%s, 'Complaint Assigned', %s)""",
            (session["user_id"], f"Complaint {complaint_id} assigned to staff {staff_id}")
        )

        conn.commit()

        return jsonify({
            "message": "Maintenance staff assigned successfully!",
            "complaint_id": complaint_id,
            "staff_id": staff_id,
            "status": "Assigned"
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route("/api/complaints/<int:complaint_id>/status", methods=["PUT"])
def update_complaint_status(complaint_id):
    if "user_id" not in session:
        return jsonify({"error": "Please login first"}), 401

    if session.get("role") != "Maintenance Staff":
        return jsonify({"error": "Maintenance staff access required"}), 403

    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "").strip()

    if new_status not in ["In Progress", "Resolved"]:
        return jsonify({"error": "Invalid status"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """SELECT c.status
            FROM Complaints c
            JOIN Assignments a
            ON c.complaint_id = a.complaint_id
            WHERE c.complaint_id = %s
            AND a.staff_id = %s
            AND a.is_active = TRUE""",
            (complaint_id, session["user_id"])
        )

        complaint = cursor.fetchone()

        if not complaint:
            return jsonify({
                "error": "Complaint not assigned to you"
            }), 403

        old_status = complaint[0]

        allowed_transitions = {
            "Assigned": "In Progress",
            "In Progress": "Resolved"
        }

        if allowed_transitions.get(old_status) != new_status:
            return jsonify({
                "error": "Invalid status transition"
            }), 400

        cursor.execute(
            """UPDATE Complaints
            SET status = %s
            WHERE complaint_id = %s""",
            (new_status, complaint_id)
        )

        cursor.execute(
            """INSERT INTO Status_History
            (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (%s, %s, %s, %s, %s)""",
            (
                complaint_id,
                session["user_id"],
                old_status,
                new_status,
                "Status updated by maintenance staff"
            )
        )

        cursor.execute(
            """INSERT INTO Activity_Logs
            (user_id, action, details)
            VALUES (%s, %s, %s)""",
            (
                session["user_id"],
                "Complaint Status Updated",
                f"Complaint {complaint_id}: {old_status} to {new_status}"
            )
        )

        conn.commit()

        return jsonify({
            "message": "Complaint status updated successfully!",
            "complaint_id": complaint_id,
            "old_status": old_status,
            "new_status": new_status
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully!"})


@app.route("/api/staff", methods=["GET"])
def get_maintenance_staff():
    if "user_id" not in session:
        return jsonify({"error": "Please login first"}), 401

    if session.get("role") != "Administrator":
        return jsonify({"error": "Admin access required"}), 403

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT user_id, full_name, email
            FROM Users
            WHERE role_id = (
                SELECT role_id FROM Roles
                WHERE role_name = 'Maintenance Staff'
            )
        """)

        staff = cursor.fetchall()
        return jsonify(staff)

    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    app.run(debug=True)
