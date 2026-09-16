import QRCode from 'qrcode'

export function reportURL(patientId: string): string {
  return `${window.location.origin}/report/${patientId}`
}

export function qrDataURL(text: string, size: number): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#14231c', light: '#ffffff' },
  })
}

interface CardDetails {
  name: string
  bloodGroup: string
  contact: string
  serial: string
  url: string
}

const WIDTH = 2024
const HEIGHT = 1276
const PAD = 96

// The card is drawn at print resolution rather than screenshotted, because the
// thing that has to survive a bad phone camera at the roadside is the QR.
export async function drawCard(details: CardDetails): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser cannot render the card.')

  ctx.fillStyle = '#14231c'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 2
  for (let x = -HEIGHT; x < WIDTH; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, HEIGHT)
    ctx.lineTo(x + HEIGHT * 0.5, 0)
    ctx.stroke()
  }

  const qrSize = 470
  const qrX = WIDTH - PAD - qrSize
  const qrY = Math.round((HEIGHT - qrSize) / 2) + 34
  const textRight = qrX - 80

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '600 54px Georgia, serif'
  ctx.fillText('ArogyaKhosh', PAD, PAD + 46)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '400 30px system-ui, sans-serif'
  ctx.fillText('Emergency record', PAD, PAD + 94)

  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, PAD + 148)
  ctx.lineTo(textRight, PAD + 148)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${fitting(ctx, details.name || 'Unnamed', textRight - PAD, 112)}px Georgia, serif`
  ctx.fillText(details.name || 'Unnamed', PAD, PAD + 300)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 32px system-ui, sans-serif'
  ctx.fillText(
    details.contact ? `Emergency contact · ${details.contact}` : 'Emergency contact pending',
    PAD,
    PAD + 356,
  )

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '400 30px system-ui, sans-serif'
  ctx.fillText('Blood group', PAD, PAD + 530)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 136px Georgia, serif'
  ctx.fillText(details.bloodGroup || '—', PAD, PAD + 652)

  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath()
  ctx.moveTo(PAD, HEIGHT - PAD - 62)
  ctx.lineTo(textRight, HEIGHT - PAD - 62)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '400 27px system-ui, sans-serif'
  ctx.fillText(details.serial, PAD, HEIGHT - PAD - 12)

  ctx.textAlign = 'right'
  ctx.fillText('arogyakhosh', textRight, HEIGHT - PAD - 12)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48)

  const qr = await loadImage(await qrDataURL(details.url, qrSize))
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Scan if I am hurt', qrX + qrSize / 2, qrY - 54)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

// A long name has to stay inside the card rather than run under the code.
function fitting(ctx: CanvasRenderingContext2D, text: string, room: number, start: number): number {
  let size = start

  while (size > 48) {
    ctx.font = `700 ${size}px Georgia, serif`
    if (ctx.measureText(text).width <= room) break
    size -= 4
  }

  return size
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not draw the code.'))
    image.src = src
  })
}

export function download(dataURL: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  link.click()
}
