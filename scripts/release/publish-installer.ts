import { S3Client } from 'bun'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const client = new S3Client({
  endpoint: required('R2_ENDPOINT'),
  bucket: required('R2_BUCKET'),
  accessKeyId: required('R2_ACCESS_KEY_ID'),
  secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  region: 'auto',
})
const installer = await Bun.file('scripts/install.sh').bytes()
const response = await fetch(
  client.file('install').presign({ method: 'PUT', expiresIn: 600 }),
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: installer,
  }
)
if (!response.ok)
  throw new Error(`R2 installer upload failed: ${response.status}`)
if (
  Buffer.compare(
    Buffer.from(await client.file('install').bytes()),
    Buffer.from(installer)
  ) !== 0
)
  throw new Error('R2 installer content differs after upload')
console.log('Published and verified installer in R2')
