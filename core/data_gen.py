"""
Generates two synthetic CSVs that mimic a real reconciliation problem:
- razorpay_transactions.csv: what the payment gateway says was paid out
- bank_settlements.csv: what actually landed in the bank

Deliberately introduces realistic messiness:
- exact matches (majority)
- rounding differences (fees)
- delayed settlement (date shift)
- slightly different reference formatting
- a few genuinely missing rows (real exceptions)
"""

import pandas as pd
import random
from datetime import timedelta
from faker import Faker

fake = Faker()
random.seed(42)
Faker.seed(42)


def generate(num_rows: int = 200, out_dir: str = "sample_data"):
    razorpay_rows = []
    bank_rows = []

    base_date = pd.Timestamp("2026-08-01")

    for i in range(num_rows):
        txn_id = f"txn_{1000 + i}"
        amount = round(random.uniform(500, 50000), 2)
        date = base_date + timedelta(days=random.randint(0, 20))
        merchant = fake.company()

        razorpay_rows.append({
            "transaction_id": txn_id,
            "merchant": merchant,
            "amount": amount,
            "date": date.strftime("%Y-%m-%d"),
        })

        roll = random.random()

        if roll < 0.70:
            # clean exact match
            bank_rows.append({
                "reference": txn_id,
                "merchant_name": merchant,
                "credited_amount": amount,
                "settlement_date": date.strftime("%Y-%m-%d"),
            })
        elif roll < 0.82:
            # rounding / fee difference (should be fuzzy-matchable)
            bank_rows.append({
                "reference": txn_id,
                "merchant_name": merchant,
                "credited_amount": round(amount - random.uniform(1, 15), 2),
                "settlement_date": date.strftime("%Y-%m-%d"),
            })
        elif roll < 0.92:
            # reference genuinely doesn't line up (bank's own internal ref) AND
            # merchant name is recorded slightly differently (abbreviation/legal
            # suffix dropped) -> not confident enough for rule-based fuzzy match,
            # should land in the AI resolver
            messy_name = merchant.replace(" Ltd", "").replace(" Inc", "").replace(",", "")
            if random.random() < 0.5 and len(messy_name.split()) > 1:
                messy_name = messy_name.split()[0] + " " + messy_name.split()[-1]
            bank_rows.append({
                "reference": f"BSET-{fake.random_number(digits=6)}",
                "merchant_name": messy_name,
                "credited_amount": round(amount - random.uniform(0, 3), 2),
                "settlement_date": (date + timedelta(days=random.randint(1, 4))).strftime("%Y-%m-%d"),
            })
        else:
            # genuinely missing - real exception, no bank row at all
            pass

    # add a few bank-side rows with no matching razorpay txn (bank error / stray credit)
    for i in range(5):
        bank_rows.append({
            "reference": f"UNKNOWN-{i}",
            "merchant_name": fake.company(),
            "credited_amount": round(random.uniform(500, 5000), 2),
            "settlement_date": base_date.strftime("%Y-%m-%d"),
        })

    df_razorpay = pd.DataFrame(razorpay_rows)
    df_bank = pd.DataFrame(bank_rows)

    df_razorpay.to_csv(f"{out_dir}/razorpay_transactions.csv", index=False)
    df_bank.to_csv(f"{out_dir}/bank_settlements.csv", index=False)

    print(f"Generated {len(df_razorpay)} razorpay rows and {len(df_bank)} bank rows -> {out_dir}/")


if __name__ == "__main__":
    generate()
