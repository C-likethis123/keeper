---
pinned: false
title: "Source: Are mutexes slow?"
id: "So_aLykzv2lnaihoF2fEK"
type: "resource"
attachedVideo: "https://www.youtube.com/watch?v=tND-wBBZ8RY&list=WL&index=50"
---
# Introduction
The talk explains why mutexes are not "slow", contrary to the common observation that programs slow down due to mutexes
Common things:
- mutexes are slow
- read-write locks are best for read-heavy workloads
- lock-free data structures are always faster
Will learn:
- what is a lock?
- what is a mutex at the CPU level?
- an intuition for how concurrent programs will perform
#  Benchmark - read a shared counter
```rust
let counter = Arc::new(Mutex::new(0u64));
loop {
  let mut guard = counter.lock().unwrap();
  std::hint::black_box(*guard);
}

```


Idea:
- we'll read the shared counter. Nothing will update it, just many reads from many threads
- In a loop, the lock will guard it.
- The black box is added to make sure the benchmark isn't optimised away

More threads = worse performance
- with 1 thread = 250 million operations per second
- with 2 threads = 10x drop in operations/second
- With more threads, we expect the performance to stay roughly the same because mutexes only allow one thread at a time
- However more threads performs worse
#  Benchmark - read-write locks
RwLocks barely beats mutexes:
- performance drops with more threads
- 2 threads performance with read-write is better than 2 threads performance in mutex, but still worse than 1 thread performance
- as we keep adding locks, the performance gets worse than mutexes
#  CPU caches
CPU caches makes it cheaper to access RAM.
- It's hard for CPU to access RAM information as the copper wire is far.
- The idea is that we want to keep some information closer to the CPU. But the tradeoff is that we have less memory capacity
- Each core has their own cache.
- L1 cache = soldered to CPU
- L3 cache = close to RAM. Usually shared with all cores in the CPU.
What happens when one CPU core wants to access the memory in another CPU core?
- MESI = a protocol to negotiate information between CPU cores
- MESI corresponds to the 4 states a cache can take = modified, exclusive, shared, invalid
  - Modified
    - When the CPU writes to L1/L2 cache, the information deviates from RAM
    - If anyone else wants to read it, the core needs to give up permission and put it in a shared place in memory
  - Exclusive
    - I am the only one with the data, but it's not modified
    - If anyone wants it, they can just take it without talking to the core. They don't need any data from the core.
  - Shared
    - Multiple caches have a the same value
  - Invalid
    - No copy of the cache line - maybe the core used to have it but they can't use it anymore because it's given to another core.
- Changing states
  - If you want to write to a shared state, make sure no one else has it in the shared state.
  - Make sure people realises you moved it to the exclusive state.
  - if someone wants to read it, they need to tell the core to convert it to the shared state so they have a read-only copy
- question: if it's the only copy, how can it be dirty?
- The cache keps an entry for every piece of memory - the CPU has cache lines. it takes the main memory, divides to 64 byte of chunks. Each chunk is a cache line.
Observation: writes to shared data requires coordination between cores
- a read-write lock between 2 cores requires 2 cache line transfers -- one to increment counter, one to decrement when releasing
- In a read-write lock, it requires writing to a shared counter when acquiring a read lock.
- coordinating states causes cache ping-pong, which takes ~30ns, approaching main memory
- for mutexes, it's not so bad because we hold the lock. No one else will acquire the lock from you, so there is no mutation of shared state.
- Reader locks scale worse - they contend more with each other. Mutexes don't contend with each other as they don't cause cache-line ping pong

<details>
<summary>Case study</summary>

step 1:
- core 0 `fetch_add`. cache line is modified, core 1 is unchanged
step 2:
- core 1 wants to lock. It sends a write request.
step 3: core 1 runs `fetch_add`. core0 sends value to core1. core1 writes to value, invalidating the value in core0. there is only 1 value in core1.
step 4: core0 wants to unlock, it sends a write request to core1's value.
step 5: core1 sends a value to core0

note that in here, there is an optimisation where the value does not need to be promoted to a shared state.

</details>


Why was this issue not talked about more?
- In long work - locks are acquired with overhead, but the overhead takes up ~11% of the entire code.
- In short work, highly specialised code with lots of loops over critical sections - the overhead can be up to ~92%
# Left-right data structure
If we cannot use read-write locks and mutexes, what should we use?
Idea: what if readers never wrote to shared state?

Left-right data structure
- Enormous reads, small writes. The writes were needed for a hashmap lookup.
- Keep two copies of the data
  - one for all readers
  - one for the writer
- There is an atomic pointer that the reader and writer has access to. The readers will read the left copy. The writer will modify the right copy.
- When the writer makes modifications to the write copy, it will switch the pointer to the right copy. The readers will now be reading from the right copy, and the writer will own the left copy.
- Readers do not need to coordinate in this case, just read from the read-only copy. The writer only needs to know which side is safe to modify.
- Question: why is this approach faster?
  - Readers don't need to wait - even with concurrent writes, they can read their copy
Smoothen the kinks in this idea: when the writer changes the pointer, it needs to know if all readers know the updated pointer, so the writer can change the pointer.
- We can give every reader their own cache line, which keeps track at the number of times they read the pointer
- The writer will look at the counter for every reader, and check that the counter changes by one since the pointer swapped.
- This works because the writer tracked the state before the pointer swap, and if the counter changes, it means the reader has read the updated value

Question: why do all readers need access to the same cache line? They should be independent.

Question: if a thread is dormant, and they hold the old reference and don't increment the reads, is it an issue?
- The reader will increment before and after it starts an operation.
- The writer needs to look out if it goes up or if it's dormant. Dormant reader threads prevent the writer from making updates

left-right reads scale linearly with number of reader threads - and this only works if writes are rare
- only writes can make contention in the system
- The reader-writer lock gets punished as more readers are added

#  4 core cliff
The issue is false sharing - each reader has its own epoch counter, but multiple readers may have their counter on the same cache line.



| Readers | Ops/sec | Expected |
| --- | --- | --- |
| 1 | 213M | 213M |
| 2 | 426M | 426M |
| 3 | 628M | 639M |
| 4 | 57M | 825M |
| 8 | 945M | 1.7B |

When benchmarking left-right, there is a performance anomaly - it slows down at exactly 4 cores
-  Even if one reader's counter is changed, it invalidates the entire cache line
- To truly have an individual cache line - align it with the word `#[repr(align(64))] struct PaddedEpoch(AtomicUsize)`
- Even "lock-free" code can suffer from cache coherence
# Choose wisely
Know what your program is doing
left-right is not a drop in replacement:
- 2x memory usage (two copies)
- readers see stale data during publish
- single writer only
- operations must be deterministic
- writer waits for all readers to exit

Questions:
1.  read/write ratio
2. How long is the critical section?
3. How many threads will contend?
4. Can I tolerate stale reads?
5. Do I need linearizability?

# Takeaways
It's not about locks - coordination is expensive because of cache coherence, not because of locks.
Understanding cache topology and shared writes is the key to scalable concurrent code

#  Further reading
- [ ] [[What every programmer should know about memory]]
- [ ] [[Is parallel programming hard]]
- [ ] [[Scalable read-write locks]]
- [ ] [[The left right crate]]