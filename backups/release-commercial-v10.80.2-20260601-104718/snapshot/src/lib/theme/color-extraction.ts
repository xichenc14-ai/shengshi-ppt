/**
 * Color Extraction — K-means clustering to extract dominant colors from images
 * Used for brand color import feature
 */

/**
 * Extract dominant colors from an image URL using K-means clustering
 * @param imageUrl URL or data URL of the image
 * @param count Number of colors to extract (default 3)
 * @returns Array of hex color strings
 */
export async function extractBrandColors(imageUrl: string, count: number = 3): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        // Scale down for performance (max 100x100)
        const maxSize = 100
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.floor(img.width * scale)
        canvas.height = Math.floor(img.height * scale)

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data

        // Extract RGB pixels
        const rgbPixels: [number, number, number][] = []
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]
          // Skip transparent pixels
          if (a < 128) continue
          // Skip very dark or very light pixels
          const brightness = (r + g + b) / 3
          if (brightness < 20 || brightness > 235) continue
          rgbPixels.push([r, g, b])
        }

        if (rgbPixels.length === 0) {
          resolve(['#808080'])
          return
        }

        // Run K-means
        const clusters = kMeans(rgbPixels, count)

        // Sort by cluster size (most dominant first)
        clusters.sort((a, b) => b.count - a.count)

        const colors = clusters.map(c => rgbToHex(c.center[0], c.center[1], c.center[2]))
        resolve(colors)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`))
    img.src = imageUrl
  })
}

interface Cluster {
  center: [number, number, number]
  count: number
}

/**
 * K-means clustering
 */
function kMeans(pixels: [number, number, number][], k: number, maxIter: number = 20): Cluster[] {
  // Initialize centroids randomly from pixels
  const centroids: [number, number, number][] = []
  const usedIndices = new Set<number>()

  while (centroids.length < k && centroids.length < pixels.length) {
    const idx = Math.floor(Math.random() * pixels.length)
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx)
      centroids.push([...pixels[idx]])
    }
  }

  if (centroids.length === 0) {
    return [{ center: [128, 128, 128], count: pixels.length }]
  }

  let assignments: number[] = new Array(pixels.length).fill(0)

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign pixels to nearest centroid
    const newAssignments = pixels.map(pixel =>
      centroids.reduce((minIdx, centroid, idx) => {
        const dist = colorDistance(pixel, centroid)
        const minDist = colorDistance(pixel, centroids[minIdx])
        return dist < minDist ? idx : minIdx
      }, 0)
    )

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) {
      break
    }
    assignments = newAssignments

    // Update centroids
    for (let i = 0; i < centroids.length; i++) {
      const clusterPixels = pixels.filter((_, idx) => assignments[idx] === i)
      if (clusterPixels.length > 0) {
        centroids[i] = [
          Math.round(clusterPixels.reduce((sum, p) => sum + p[0], 0) / clusterPixels.length),
          Math.round(clusterPixels.reduce((sum, p) => sum + p[1], 0) / clusterPixels.length),
          Math.round(clusterPixels.reduce((sum, p) => sum + p[2], 0) / clusterPixels.length),
        ]
      }
    }
  }

  // Count cluster sizes
  const counts = new Array(centroids.length).fill(0)
  assignments.forEach(a => counts[a]++)

  return centroids.map((center, i) => ({ center, count: counts[i] }))
}

/**
 * Euclidean distance in RGB space (weighted for human perception)
 */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const rMean = (a[0] + b[0]) / 2
  const r = a[0] - b[0]
  const g = a[1] - b[1]
  const bl = a[2] - b[2]
  return Math.sqrt(
    (2 + rMean / 256) * r * r +
    4 * g * g +
    (2 + (255 - rMean) / 256) * bl * bl
  )
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
}

/**
 * Simple median cut algorithm (alternative to K-means, faster)
 */
export async function extractBrandColorsFast(imageUrl: string, count: number = 3): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        const maxSize = 80
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.floor(img.width * scale)
        canvas.height = Math.floor(img.height * scale)

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // Collect pixels
        const pixels: [number, number, number][] = []
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
          if (brightness < 20 || brightness > 235) continue
          pixels.push([data[i], data[i + 1], data[i + 2]])
        }

        if (pixels.length === 0) {
          resolve(['#808080'])
          return
        }

        const buckets = medianCut(pixels, count)
        const colors = buckets.map(bucket => {
          const avg: [number, number, number] = [0, 0, 0]
          bucket.forEach(p => { avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2] })
          return rgbToHex(avg[0] / bucket.length, avg[1] / bucket.length, avg[2] / bucket.length)
        })

        resolve(colors)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`))
    img.src = imageUrl
  })
}

/**
 * Median cut color quantization
 */
function medianCut(pixels: [number, number, number][], k: number): [number, number, number][][] {
  const buckets: [number, number, number][][] = [pixels]

  while (buckets.length < k) {
    // Find the bucket with the largest range
    let maxRangeIdx = 0
    let maxRange = 0

    buckets.forEach((bucket, idx) => {
      const range = getColorRange(bucket)
      if (range > maxRange) {
        maxRange = range
        maxRangeIdx = idx
      }
    })

    const bucket = buckets[maxRangeIdx]
    if (bucket.length < 2) break

    // Split along the channel with greatest range
    const rangeR = channelRange(bucket, 0)
    const rangeG = channelRange(bucket, 1)
    const rangeB = channelRange(bucket, 2)

    let channel = 0
    if (rangeB >= rangeR && rangeB >= rangeG) channel = 2
    else if (rangeG >= rangeR && rangeG >= rangeB) channel = 1

    bucket.sort((a, b) => a[channel] - b[channel])
    const mid = Math.floor(bucket.length / 2)
    buckets.splice(maxRangeIdx, 1, bucket.slice(0, mid), bucket.slice(mid))
  }

  return buckets.filter(b => b.length > 0)
}

function getColorRange(pixels: [number, number, number][]): number {
  if (pixels.length === 0) return 0
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0
  pixels.forEach(p => {
    minR = Math.min(minR, p[0]); maxR = Math.max(maxR, p[0])
    minG = Math.min(minG, p[1]); maxG = Math.max(maxG, p[1])
    minB = Math.min(minB, p[2]); maxB = Math.max(maxB, p[2])
  })
  return (maxR - minR) + (maxG - minG) + (maxB - minB)
}

function channelRange(pixels: [number, number, number][], channel: number): number {
  let min = 255, max = 0
  pixels.forEach(p => { min = Math.min(min, p[channel]); max = Math.max(max, p[channel]) })
  return max - min
}
