/**
 * Dice Agent Tools
 *
 * Pure computational functions with no external dependencies.
 * These tools demonstrate:
 * - Simple number generation (random)
 * - Basic mathematical computation (prime checking)
 * - No API calls, no I/O
 */

/**
 * Roll an N-sided dice
 *
 * @param sides - Number of sides on the dice (default: 6)
 * @returns A random number between 1 and sides (inclusive)
 */
export function rollDice(sides: number = 6): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Check if a number is prime
 *
 * @param num - The number to check
 * @returns true if the number is prime, false otherwise
 */
function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;

  const sqrt = Math.floor(Math.sqrt(num));
  for (let i = 3; i <= sqrt; i += 2) {
    if (num % i === 0) return false;
  }

  return true;
}

/**
 * Check which numbers from a list are prime
 *
 * @param numbers - Array of numbers to check
 * @returns A human-readable string indicating which numbers are prime
 */
export function checkPrime(numbers: number[]): string {
  const primes = numbers.filter(isPrime);

  if (primes.length === 0) {
    return "No prime numbers found.";
  }

  return `${primes.join(", ")} are prime numbers.`;
}

