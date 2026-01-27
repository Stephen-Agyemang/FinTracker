# 💰 FinTracker

FinTracker is a lightweight Command Line Interface (CLI) application designed to help you track your personal expenses and manage your budget efficiently.

## 🚀 Features

- **Quick Entry**: Add expenses with a name, amount, and category in seconds.
- **Categorized Tracking**: Organize spending into predefined categories (Food, Education, Home, Utilities, etc.).
- **Smart Summaries**: Get a breakdown of your spending by category and total monthly expenditure.
- **Budget Monitoring**: Automatically calculates your remaining budget and provides a suggested daily spending limit for the rest of the month.
- **Persistent Storage**: All data is saved locally to a `expenses.csv` file for easy access and portability.

## 🛠️ Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/YOUR_USERNAME/FinTracker.git
    cd FinTracker
    ```

2.  **Set up a virtual environment (optional but recommended)**:
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On macOS/Linux
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## 💻 Usage

Run the main application:

```bash
python app/fintracker.py
```

Follow the on-screen prompts to enter your expense details. Once entered, the app will:
1.  Save your entry to `expenses.csv`.
2.  Display a summary of all recorded expenses.
3.  Show your current budget status and daily spending limits.

## 📁 Project Structure

- `app/fintracker.py`: The main entry point and terminal logic.
- `app/expense.py`: The core `Expense` class definition.
- `expenses.csv`: The local database storing your entries (ignored by Git to keep your data private).
- `requirements.txt`: Project dependencies.

## �️ Roadmap

FinTracker is currently a CLI-based tool, but I have big plans for its evolution:
- [ ] **Full-Stack Transformation**: Migrating from a CLI to a modern web application (React/Next.js).
- [ ] **Database Integration**: Replacing CSV storage with a robust SQL/NoSQL database.
- [ ] **User Authentication**: Secure login to manage personal finance data across devices.
- [ ] **Data Visualization**: Adding interactive charts and graphs to track spending trends.
- [ ] **API Access**: Developing a RESTful API to allow for mobile app integration.

## �📝 License

This project is open-source and available under the [MIT License](LICENSE).
