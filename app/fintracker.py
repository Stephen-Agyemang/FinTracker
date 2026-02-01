def print_table(headers, rows, col_widths=None):
    # Calculate column widths
    if not col_widths:
        col_widths = [max(len(str(h)), max((len(str(row[i])) for row in rows), default=0)) for i, h in enumerate(headers)]
    # Borders
    border = '+' + '+'.join(['-' * (w + 2) for w in col_widths]) + '+'
    # Header
    header_row = '| ' + ' | '.join([str(h).ljust(col_widths[i]) for i, h in enumerate(headers)]) + ' |'
    print(border)
    print(header_row)
    print(border)
    # Rows
    for row in rows:
        print('| ' + ' | '.join([str(row[i]).ljust(col_widths[i]) for i in range(len(headers))]) + ' |')
    print(border)
import os
from expense import Expense
import calendar
import datetime



def main():
    print(f"Running FinTracker...")
    expense_file_path = "expenses.csv"
    budget = 2000.00

    # Get user to input their expenses
    expense: Expense = get_user_input()

    # Record it into a file or database
    save_expense_to_file(expense, expense_file_path)

    #Read the file and summarize the expenses
    summarize_expenses(expense_file_path, budget)
    

def get_user_input() -> Expense:
    try:
        expense_name = input("Enter expense name: ")
        expense_amount = float(input("Enter expense amount: "))
    except ValueError:
        print("Invalid input. Please enter a valid amount.")
        return get_user_input()  

    expense_categories = [
        "🍔Food",
        "📚Education",
        "🏠Home",
        "⚡Utilities",
        "🎶Entertainment",
        "🏥Health",
        "🚗Transportation",
        "📦 Subscriptions",
        "🤷Miscellaneous",
    ]

    while True:
        print("Select your expense category: ")
        
        for i, category in enumerate(expense_categories, start=1):
            print(f"  {i}. {category}")

        value_range = f"[ 1-{len(expense_categories)} ] "

        try:
            selected_option = int(input(f"Enter a category number: \n {value_range}: ")) - 1
        except ValueError:
            print("Invalid input. Please enter a valid number.")
            continue
        # Fix problem of a user entering something that is not a number or out of range
        
        if selected_option in range(len(expense_categories)):
            selected_category = expense_categories[selected_option]
            new_expense = Expense(name = expense_name, 
                                  category = selected_category, 
                                  amount = expense_amount)
            return new_expense

        else: 
            print(f"Invalid option. Please try again.")
            continue
 

def save_expense_to_file(expense: Expense, expense_file_path: str):
    headers = ["Name", "Category", "Amount ($)"]
    rows = [[expense.name, expense.category, f"{expense.amount:.2f}"]]
    print_table(headers, rows)
    with open(expense_file_path, "a") as file:
        file.write(f"{expense.name},{expense.category},{expense.amount}\n")


def summarize_expenses(expense_file_path: str, budget: float ):
    
    if not os.path.exists(expense_file_path):
        print(f"No expenses file found.")
        return
    
    expenses: list[Expense] = []
    
    with open(expense_file_path, "r") as file:  
        lines = file.readlines()
        for line in lines:
            expense_name, expense_category, expense_amount = [x.strip() for x in line.strip().split(",")]
            line_expense = Expense(name=expense_name, category=expense_category, amount=float(expense_amount))
            expenses.append(line_expense)

    amount_by_category: dict[str, float] = {}
    for expense in expenses:
        key = expense.category
        if key in amount_by_category:
            amount_by_category[key] += expense.amount
        else:
            amount_by_category[key] = expense.amount

    print(f"\n\033[1m    EXPENSES LIST " + "\033[0m")
    headers = ["Name", "Category", "Amount ($)"]
    rows = [[exp.name, exp.category, f"{exp.amount:.2f}"] for exp in expenses]
    print_table(headers, rows)

    print(f"\033[1m    EXPENSE BY CATEGORY SUMMARY \033[0m")
    headers = ["Category", "Total Amount ($)"]
    rows = [[key, f"{amount:.2f}"] for key, amount in amount_by_category.items()]
    print_table(headers, rows)

    total_spent = sum([expense.amount for expense in expenses])
    print(f"\033[1m    TOTAL SPENT \033[0m")
    print(f"You've spent ${total_spent:.2f} this month\n")

    remaining_budget = budget - total_spent
    print(f"\033[1m    BUDGET STATUS \033[0m")
    if remaining_budget >= 0:
        print(f"You are within your budget! You have ${remaining_budget:.2f} remaining.\n")
    else:
        print(f"You've exceeded your budget by ${-remaining_budget:.2f}. Consider cutting down and increasing budget.\n")

    now = datetime.datetime.now()
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    remaining_days = days_in_month - now.day
    print(f"\033[1m    DAYS REMAINING THIS MONTH \033[0m")
    if remaining_days == 1:
        print(f"{remaining_days} day remaining in this month. Finish hard under budget.\n")
    else:
        print(f"{remaining_days} days remaining in this month.Finish hard under budget.\n")

    daily_budget = remaining_budget / remaining_days if remaining_days > 0 else 0
    print(f"\033[1m    DAILY BUDGET  \033[0m")
    if daily_budget >= 0:
        print(f"You can spend up to ${daily_budget:.2f} per day for the rest of the month to stay within your budget.\n")
    else:
        print(f"Budget exceeded for this month.\n")
        print( f"{green_text('Tip:')} Consider cutting back on daily expenses or increasing you budget!\n")


def green_text(text: str) -> str:
    return f"\033[92m{text}\033[0m"

if __name__ == "__main__":
    main()