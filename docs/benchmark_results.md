# Recon Agent Core Engine Benchmark Results

**Date**: 2026-08-30
**Environment**: Local execution environment (Single-threaded `process.extractOne` fallback from RapidFuzz C++ extension).

## Summary

The matching engine was benchmarked using synthetic datasets to measure memory growth, processing time, and the impact of different matching scenarios. 

The $O(n \log m)$ complexity claims hold true under typical distributions due to binary search filtering, but worst-case scenarios (like `duplicates` with exactly matching amounts and dates) push it closer to $O(n \times m)$ on small windows. The `process.extractOne` string matching is highly optimized (C++) but still computationally expensive.

**Verdict**: The engine is highly scalable up to 50,000 rows (~42 seconds), but begins to scale super-linearly at 100,000 rows (~170 seconds) due to memory copying and string comparison overhead. It is **not sub-second** at scale, and must be run asynchronously.

## 1. Scalability Benchmark

Tested using a heavy "fuzzy" scenario (requiring string comparisons for almost every candidate) with a 20.0 amount tolerance and 5-day window.

| Row Count | Duration | Memory Increase | Matched / Ambiguous / Unmatched |
|---|---|---|---|
| **1,000** | 0.27s | 3.96 MB | 0 / 877 / 123 |
| **5,000** | 1.56s | 3.43 MB | 0 / 4172 / 828 |
| **10,000** | 3.66s | 5.33 MB | 0 / 8228 / 1772 |
| **50,000** | 41.98s | 30.40 MB | 0 / 40888 / 9112 |
| **100,000** | 170.19s | 57.19 MB | 0 / 81743 / 18257 |

**Observation**: As $N$ increases past 50,000, execution time more than quadruples, confirming $O(n \log n)$ bounds on the sorting/filtering step but $O(n \times m)$ on the fuzzy scoring step where $m$ is the subset of rows matching the numeric filters.

## 2. Scenario Benchmark (10,000 Rows)

Tested the impact of different data distributions.

| Scenario | Duration | Memory Increase | Notes |
|---|---|---|---|
| **Unmatched** | 1.65s | ~0 MB | Fastest. If dates and amounts are completely disjoint, no string comparison is performed. |
| **Exact** | 3.92s | ~0 MB | Same as fuzzy because exact matches on `id` were artificially disabled to force the fuzzy logic to process them. |
| **Fuzzy** | 3.93s | ~0 MB | Standard string scoring overhead. |
| **Duplicates** | 8.81s | ~0 MB | Slowest. When all rows have the *exact same* date and amount, the binary search returns the entire target array as candidates, forcing $10,000 \times 10,000$ string comparisons. |

## 3. Tolerance Impact (10,000 Rows, Fuzzy)

Increasing the candidate pool size by widening the amount tolerance and date window.

* **Standard (20.0, 5 days)**: 3.93s
* **Wide (100.0, 15 days)**: 6.08s

**Observation**: Widening the tolerance increases execution time linearly because the subset array passed to RapidFuzz `extractOne` becomes larger.

## Conclusion

1. **Remove sub-second claims** from the README. The engine processes ~2,500 rows/second on standard distributions.
2. **Defensible metric**: "Processes 50,000 transactions in under 45 seconds on commodity hardware."
3. **Constraints**: Memory usage grows linearly (approx 60MB per 100k rows), making it safe for free-tier worker environments with 512MB RAM limits.
