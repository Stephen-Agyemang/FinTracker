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
    print(f"🎯 Getting user expenses...")
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
    print("\n🎯 Saving expense to file...")
    print("+--------------------+------------------+------------+")
    print(f"| {'Name':<18} | {'Category':<16} | {'Amount':>10} |")
    print("+--------------------+------------------+------------+")
    print(expense)
    print("+--------------------+------------------+------------+")
    print(f"\n...to {expense_file_path}\n")
    with open(expense_file_path, "a") as file:
        file.write(f"{expense.name},{expense.category},{expense.amount}\n")


def summarize_expenses(expense_file_path: str, budget: float ):
    print(f"\n🎯 Summarizing expenses...")
    
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

    print(f"\n\033[1m=========== EXPENSES LIST ===========\033[0m")
    print("+--------------------+------------------+------------+")
    print(f"| {'Name':<18} | {'Category':<16} | {'Amount':>10} |")
    print("+--------------------+------------------+------------+")
    for exp in expenses:
        print(exp)
    print("+--------------------+------------------+------------+\n")

    print(f"\033[1m=========== EXPENSE BY CATEGORY SUMMARY ===========\033[0m")
    print("+------------------+-----------------+")
    print(f"| {'Category':<16} | {'Total Amount':>15} |")
    print("+------------------+-----------------+")
    for key, amount in amount_by_category.items():
        print(f"| {key:<16} | {amount:>15.2f} |")
    print("+------------------+-----------------+\n")

    total_spent = sum([expense.amount for expense in expenses])
    print(f"\033[1m=========== TOTAL SPENT ===========\033[0m")
    print(f"You've spent ${total_spent:.2f} this month\n")

    remaining_budget = budget - total_spent
    print(f"\033[1m=========== BUDGET STATUS ===========\033[0m")
    if remaining_budget >= 0:
        print(f"You are within your budget! You have ${remaining_budget:.2f} remaining.\n")
    else:
        print(f"You've exceeded your budget by ${-remaining_budget:.2f}. Consider reviewing your expenses.\n")

    now = datetime.datetime.now()
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    remaining_days = days_in_month - now.day
    print(f"\033[1m=========== DAYS REMAINING IN MONTH ===========\033[0m")
    print(f"There are {remaining_days} days remaining in this month.\n")

    daily_budget = remaining_budget / remaining_days if remaining_days > 0 else 0
    print(f"\033[1m=========== DAILY BUDGET ===========\033[0m")
    if daily_budget >= 0:
        print(f"You can spend up to ${daily_budget:.2f} per day for the rest of the month to stay within your budget.\n")
    else:
        print(f"You have exceeded your budget for the month. Consider cutting back on daily expenses.\n")


def green_text(text: str) -> str:
    return f"\033[92m{text}\033[0m"

if __name__ == "__main__":
    main()