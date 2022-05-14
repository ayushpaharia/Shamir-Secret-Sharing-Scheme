// Shamir Threshold Secret Sharing using Galois Field 256
// run by node sss.mjs <secret>
import Decimal from "decimal.js"

function main() {
  console.clear()
  Decimal.set({ rounding: 5 })
  Decimal.set({ modulo: Decimal.ROUND_FLOOR })
  Decimal.set({ precision: 1e4 })
  Decimal.set({ toExpPos: 1000 })

  const SECRET =
    "0xe9873d79c6d87dc0fb6a5778633389f4453213303da61f20bd67fc233aa33262" // secret hex string

  const SHARES = 10 // total shares ( should be > 0 )
  const THRESHOLD = 3 // the minimum number of shares required to unlock the secret ( should be > 0 and < shares )

  const prime3217 = Decimal("2").pow(3217).sub(1)

  const shares = split(SECRET, SHARES, THRESHOLD, prime3217) // Generate shares

  console.log("[Generating Shares...]")

  // If shares.length < threshold, then the secret cannot be recovered
  const lessThan_threshold = join([shares[0], shares[1]], prime3217).toHex()

  // If shares.length = threshold, then the secret is unlocked
  const equalTo_threshold = join(
    [shares[0], shares[1], shares[2]],
    prime3217,
  ).toHex()
  // If shares.length > threshold, then the secret is unlocked
  const greaterThan_threshold = join(
    [shares[0], shares[1], shares[2], shares[3]],
    prime3217,
  ).toHex()

  console.log({
    lessThan_threshold: lessThan_threshold === SECRET,
    equalTo_threshold: equalTo_threshold === SECRET,
    greaterThan_threshold: greaterThan_threshold === SECRET,
  })
}

main()

function divmod(a, b, num) {
  let decimalZero = Decimal(0)
  let decimalOne = Decimal(1)
  let NUM = num
  let numRemainder = b.mod(num)
  let tmp
  while (!numRemainder.isZero()) {
    let quot = Decimal.floor(NUM.div(numRemainder))
    tmp = decimalOne
    decimalOne = decimalZero.sub(quot.times(decimalOne))
    decimalZero = tmp
    tmp = numRemainder
    numRemainder = NUM.sub(quot.times(numRemainder))
    NUM = tmp
  }
  if (NUM.greaterThan(1)) return Decimal(0)
  if (decimalZero.isNegative()) decimalZero = decimalZero.add(num)
  return a.times(decimalZero).mod(num)
}

function customRandom(b, t) {
  if (b > t) {
    const temp = b
    b = t
    t = temp
  }

  return b.add(
    Decimal.random()
      .times(t.sub(b + 1))
      .floor(),
  )
}

function powerTimesCoefficients(x, { a }) {
  let value = a[0]
  for (let i = 1; i < a.length; i++) {
    let val = new Decimal(x).pow(i).times(a[i])
    value = value.add(val)
  }

  return value
}

function split(secret, n, k, prime) {
  const S = Decimal(secret)
  const p = Decimal(prime)

  if (S.greaterThan(prime)) {
    throw new Error("Secret is too large")
  }

  let a = [S]
  let shares = []

  while (--k) {
    let coeff = customRandom(Decimal(0), p.sub(0x1))
    a.push(coeff)
  }

  let i = 0
  while (++i < n) {
    let x = Decimal(i + 1)
    shares.push({
      x,
      y: powerTimesCoefficients(x, { a }).mod(p),
    })
  }

  return shares.map((share) => ({
    x: share.x.toString(),
    y: share.y.toHex(),
  }))
}

function lagrangeBasis(data, j) {
  let denominator = Decimal(1)
  let numerator = Decimal(1)

  for (let i = 0; i < data.length; i++) {
    if (!data[j].x.equals(data[i].x)) {
      denominator = denominator.times(data[i].x.minus(data[j].x))
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (!data[j].x.equals(data[i].x)) {
      numerator = numerator.times(data[i].x)
    }
  }

  return {
    numerator,
    denominator,
  }
}

function lagrangeInterpolate(data, p) {
  let S = Decimal(0)

  for (let i = 0; i < data.length; i++) {
    let basis = lagrangeBasis(data, i)
    S = S.add(
      data[i].y.times(
        divmod(
          Decimal(basis.numerator),
          Decimal(basis.denominator),
          Decimal(p),
        ),
      ),
    )
  }

  return S.mod(p)
}

function join(shares, prime) {
  const decimalShares = shares.map((share) => ({
    x: Decimal(share.x),
    y: Decimal(share.y),
  }))

  return lagrangeInterpolate(decimalShares, Decimal(prime))
}
