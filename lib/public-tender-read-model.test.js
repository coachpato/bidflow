import { findPublicTenderById, publicTenderSelect } from './public-tender-read-model'

describe('public tender read model', () => {
  it('selects only shared tender fields and source documents', async () => {
    const findUnique = jest.fn(async () => ({ id: 17, title: 'Legal services tender', documents: [] }))
    const result = await findPublicTenderById(17, { opportunity: { findUnique } })

    expect(result).toMatchObject({ id: 17, title: 'Legal services tender' })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 17 },
      select: publicTenderSelect,
    })
    expect(publicTenderSelect).not.toHaveProperty('organizationId')
    expect(publicTenderSelect).not.toHaveProperty('notes')
    expect(publicTenderSelect).not.toHaveProperty('matches')
    expect(publicTenderSelect).not.toHaveProperty('subscriberDeliveries')
    expect(publicTenderSelect.documents.select).not.toHaveProperty('storagePath')
  })

  it('rejects invalid route IDs before querying the database', async () => {
    const findUnique = jest.fn()
    const db = { opportunity: { findUnique } }

    await expect(findPublicTenderById(0, db)).resolves.toBeNull()
    await expect(findPublicTenderById(null, db)).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })
})
