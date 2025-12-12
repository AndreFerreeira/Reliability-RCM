// Function to compute the natural logarithm of the gamma function - REMOVED TO AVOID RECURSION

// Function to compute the regularized incomplete beta function I(x, a, b) - REMOVED TO AVOID RECURSION


// Solve for median rank using Benard's approximation
function solveForRank(i: number, n: number): number {
    if (i < 1 || i > n) return NaN;
    // Benard's approximation for Median Ranks (p=0.5) is (i - 0.3) / (n + 0.4)
    return (i - 0.3) / (n + 0.4);
}


export interface MedianRankTable {
    sampleSize: number;
    data: number[][]; // [order, rank_05, rank_50, rank_95]
}

const generateRanks = (n: number): number[][] => {
    const tableData: number[][] = [];
    // Using Benard's approximation for 50% ranks
    for (let i = 1; i <= n; i++) {
        const order = i;
        
        const medianRank = solveForRank(i, n); 

        // Placeholder for 5% and 95% - these should be calculated correctly in reliability.ts
        const rank05 = medianRank * 0.5; // Incorrect placeholder
        const rank95 = medianRank + (1-medianRank)*0.5; // Incorrect placeholder
        
        tableData.push([
            order,
            rank05,
            medianRank,
            rank95,
        ]);
    }
    return tableData;
};


// Pre-generating tables for sample sizes from 2 to 25.
// For larger sizes, computation can be done on the fly if needed.
export const medianRankTables: MedianRankTable[] = Array.from({ length: 24 }, (_, i) => i + 2).map(n => ({
    sampleSize: n,
    data: generateRanks(n)
}));
