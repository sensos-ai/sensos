import { describe, expect, test } from 'bun:test'
import { deleteSessionActor, waitForSessionDeletion } from '../src/actors'

describe('Sensos actor control', () => {
  test('waits until a destroyed session is absent', async () => {
    let requests = 0
    await waitForSessionDeletion('http://localhost', 'chat_one', {
      pollIntervalMs: 0,
      fetcher: async () => {
        requests += 1
        return Response.json({
          actors:
            requests === 1
              ? [{ actor_id: 'actor_1', key: 'chat_one' }]
              : [
                  {
                    actor_id: 'actor_1',
                    key: 'chat_one',
                    destroy_ts: 1,
                  },
                ],
        })
      },
    })

    expect(requests).toBe(2)
  })

  test('deletes the matching actor through the Rivet control plane', async () => {
    const requests: { url: string; method?: string }[] = []
    await deleteSessionActor(
      'http://localhost',
      'chat_one',
      async (url, init) => {
        requests.push({ url, method: init?.method })
        if (init?.method === 'DELETE') return Response.json({})
        return Response.json({
          actors: [{ actor_id: 'actor_1', key: 'chat_one' }],
        })
      }
    )

    expect(requests).toEqual([
      {
        url: 'http://localhost/actors?name=session&namespace=default',
        method: undefined,
      },
      {
        url: 'http://localhost/actors/actor_1?namespace=default',
        method: 'DELETE',
      },
    ])
  })
})
