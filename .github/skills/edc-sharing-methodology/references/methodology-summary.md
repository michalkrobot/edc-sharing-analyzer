# Methodology Summary From PDF

Source: Vyhodnoceni-sdileni-elektriny-POPIS-METODIKY-A-VZOROVE-PRIKLADY.pdf

## Core Concepts
- Allocation key is fixed percentage from producer EANd to consumer EANo.
- Priority index determines producer order for one consumer.
- One consumer can receive from max 5 producers.
- One producer can feed many consumers, but total producer allocation must not exceed 100%.

## Input Data
- SSE registration data:
- producer list per consumer
- priorities
- allocation percentages
- Measurement data for producer delivery and consumer demand.

## Computation Flow
1. For each 15-minute interval, compute sharing for all consumers.
2. Process by priorities in configured order.
3. Pair sharing value = min(consumer remaining demand, producer delivery times allocation percent).
4. After each pair, reduce consumer remaining demand.
5. After full iteration round, reduce producer delivery by all sharing sent from that producer.
6. Repeat by iteration rounds.
7. Final pair sharing is sum across rounds.

## Limits
- Iteration rounds:
- SSE size up to 50: rounds = number of consumers, max 5.
- SSE size above 50 or non-iterative mode: one round.
- Max share into consumer in interval is limited by that consumer demand.
- Evaluation interval is 15 minutes and independent between intervals.

## Rounding
- Sharing results are rounded down to two decimals in disfavor of sharing.

## Page Anchors In Extract
- Terminology and max 5 producers per consumer: page 3.
- Required inputs and priorities/allocation keys: pages 4 and 6.
- Process steps and formulas: pages 8 to 11.
- Rules and constraints including producer sum <= 100%: page 13.
- Worked examples with iterative updates and floor rounding: pages 17 to 65.
