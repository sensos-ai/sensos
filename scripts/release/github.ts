import { required } from './common'

export async function github(
  path: string,
  init: RequestInit = {},
  missing = false
): Promise<any> {
  const response = await fetch(
    `https://api.github.com/repos/${required('GITHUB_REPOSITORY')}/${path}`,
    {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${required('GH_TOKEN')}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    }
  )
  if (missing && response.status === 404) return null
  if (!response.ok)
    throw new Error(
      `GitHub ${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`
    )
  return response.status === 204 ? null : response.json()
}

export async function assetBytes(asset: {
  url: string
}): Promise<Uint8Array> {
  const response = await fetch(asset.url, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${required('GH_TOKEN')}`,
    },
  })
  if (!response.ok)
    throw new Error(`Unable to read release asset: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function uploadAsset(
  release: { upload_url: string },
  name: string,
  bytes: Uint8Array
) {
  const url = `${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${required('GH_TOKEN')}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(bytes),
  })
  if (!response.ok)
    throw new Error(
      `Failed to upload ${name}: ${response.status} ${await response.text()}`
    )
  return response.json()
}
