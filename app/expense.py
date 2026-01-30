class Expense:
    def __init__(self, name: str, category: str, amount: float) -> None:
        self.name = name
        self.category = category
        self.amount = amount

    def __repr__(self) -> str:
        # Table row representation (no borders, just values)
        return f"| {self.name:<18} | {self.category:<16} | {self.amount:>10.2f} |"


