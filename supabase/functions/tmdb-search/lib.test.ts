import { expect, test } from 'vitest'
import { fallbackQueries, mergeSearches, parseDetailsRequest, parseQuery, pickPerson, personTitles, searchExtra, similarity } from './lib.ts'

const homeAlone = { media_type: 'movie', id: 771, original_title: 'Home Alone', release_date: '1990-11-16', poster_path: '/h.jpg', popularity: 50 }
const none = { 'es-MX': [], 'es-AR': [], 'en-US': [] }

test('takes the Latin American title, the es-AR overview and the original title', () => {
  const [result] = mergeSearches({
    'es-MX': [{ ...homeAlone, title: 'Mi pobre angelito', overview: 'corta' }],
    'es-AR': [{ ...homeAlone, title: 'Solo en casa', overview: 'Sinopsis completa' }],
    'en-US': [{ ...homeAlone, title: 'Home Alone', overview: 'English' }],
  })
  expect(result).toEqual({
    tmdbId: 771,
    mediaType: 'movie',
    title: 'Mi pobre angelito',
    originalTitle: 'Home Alone',
    year: 1990,
    posterPath: '/h.jpg',
    overview: 'Sinopsis completa',
  })
})

test('a title found only in English keeps its English name', () => {
  const parasite = { media_type: 'movie', id: 496243, title: 'Parasite', original_title: '기생충', release_date: '2019-05-30', popularity: 30 }
  expect(mergeSearches({ ...none, 'en-US': [parasite] })[0]).toMatchObject({ tmdbId: 496243, title: 'Parasite', originalTitle: '기생충' })
})

test('ranks by best position in any language', () => {
  const x = { media_type: 'movie', id: 1, title: 'X', popularity: 1 }
  const y = { media_type: 'movie', id: 2, title: 'Y', popularity: 99 }
  const z = { media_type: 'movie', id: 3, title: 'Z', popularity: 50 }
  const ids = mergeSearches({ 'es-MX': [z, y], 'es-AR': [], 'en-US': [x] }).map((r) => r.tmdbId)
  expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2))
})

test('ties are broken by popularity', () => {
  const low = { media_type: 'movie', id: 1, title: 'Low', popularity: 1 }
  const high = { media_type: 'tv', id: 2, name: 'High', popularity: 9 }
  expect(mergeSearches({ 'es-MX': [low], 'es-AR': [], 'en-US': [high] }).map((r) => r.tmdbId)).toEqual([2, 1])
})

test('maps a series', () => {
  const bb = { media_type: 'tv', id: 1396, name: 'Breaking Bad', original_name: 'Breaking Bad', first_air_date: '2008-01-20', poster_path: null }
  expect(mergeSearches({ ...none, 'es-AR': [bb] })[0]).toMatchObject({ mediaType: 'tv', title: 'Breaking Bad', year: 2008, posterPath: null })
})

test('drops people', () => {
  const person = { media_type: 'person', id: 5, name: 'Alguien' }
  const movie = { media_type: 'movie', id: 6, title: 'Peli' }
  expect(mergeSearches({ ...none, 'es-AR': [person, movie] }).map((r) => r.tmdbId)).toEqual([6])
})

test('missing or empty dates give a null year and missing overview gives empty text', () => {
  const results = mergeSearches({
    ...none,
    'es-AR': [
      { media_type: 'movie', id: 7, title: 'Sin fecha', release_date: '' },
      { media_type: 'tv', id: 8, name: 'Tampoco' },
    ],
  })
  expect(results.map((r) => [r.year, r.overview])).toEqual([
    [null, ''],
    [null, ''],
  ])
})

test('returns at most 20', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ media_type: 'movie', id: i + 1, title: `P${i}` }))
  expect(mergeSearches({ ...none, 'es-AR': many })).toHaveLength(20)
})

test('parseQuery trims and validates', () => {
  expect(parseQuery({ query: '  parásitos ' })).toBe('parásitos')
  for (const body of [{ query: 'a' }, { query: '   ' }, { query: 'x'.repeat(101) }, {}, null, { query: 3 }]) {
    expect(parseQuery(body)).toBeNull()
  }
  expect(parseQuery({ query: 'x'.repeat(100) })).toBe('x'.repeat(100))
})

test('an exact name match in any language goes first, ignoring case and accents', () => {
  const sequel = { media_type: 'movie', id: 772, title: 'Mi pobre angelito 2', original_title: 'Home Alone 2', popularity: 99 }
  const original = { media_type: 'movie', id: 771, title: 'Mi pobre angelito', original_title: 'Home Alone', popularity: 50 }
  const parasite = { media_type: 'movie', id: 496243, title: 'Parásitos', original_title: '기생충', popularity: 10 }
  const ranked = (query: string) => mergeSearches({ 'es-MX': [sequel, original, parasite], 'es-AR': [], 'en-US': [] }, query).map((r) => r.tmdbId)
  expect(ranked('Mi pobre angelito')[0]).toBe(771)
  expect(ranked('home alone')[0]).toBe(771)
  expect(ranked('PARASITOS')[0]).toBe(496243)
  expect(ranked('mi pobre')[0]).toBe(772)
})

test('similarity: 1 for the same name, high for a typo or a name being typed, low for another name', () => {
  expect(similarity('parasitos', 'Parásitos')).toBe(1)
  expect(similarity('breking bad', 'Breaking Bad')).toBeGreaterThan(0.85)
  expect(similarity('interstelar', 'Interstellar')).toBeGreaterThan(0.85)
  expect(similarity('el padrino', 'El padrino III')).toBeGreaterThan(0.85)
  expect(similarity('breking bad', 'Bad Monkey')).toBeLessThan(0.5)
})

test('a closer name goes above a more popular one, and a typo still finds it', () => {
  const monkey = { media_type: 'tv', id: 1, name: 'Bad Monkey', popularity: 99 }
  const bb = { media_type: 'tv', id: 1396, name: 'Breaking Bad', popularity: 50 }
  expect(mergeSearches({ ...none, 'en-US': [monkey, bb] }, 'breking bad').map((r) => r.tmdbId)).toEqual([1396, 1])
})

test('what only the fallback searches found comes in only if it looks like the query, after the main results', () => {
  const monkey = { media_type: 'tv', id: 1, name: 'Bad Monkey', popularity: 99, vote_count: 900 }
  const bb = { media_type: 'tv', id: 1396, name: 'Breaking Bad', popularity: 50, vote_count: 900 }
  const other = { media_type: 'movie', id: 7, title: 'Otra cosa', popularity: 1, vote_count: 900 }
  expect(mergeSearches({ ...none, 'es-MX': [other] }, 'breking bad', { 'en-US': [monkey, bb] }).map((r) => r.tmdbId)).toEqual([1396, 7])
})

test('among fallback finds, the more popular goes first', () => {
  const latin = { media_type: 'movie', id: 1, title: 'El Padrino: The Latin Godfather', original_title: 'El padrino', popularity: 2, vote_count: 20 }
  const godfather = { media_type: 'movie', id: 238, title: 'El Padrino', original_title: 'The Godfather', popularity: 90, vote_count: 20000 }
  expect(mergeSearches(none, 'el padirno', { 'es-MX': [latin, godfather] }).map((r) => r.tmdbId)).toEqual([238, 1])
})

test('an almost unvoted exact name goes below a well known close one', () => {
  const junk = { media_type: 'movie', id: 1, title: 'Interstelar', popularity: 0.5, vote_count: 0 }
  const real = { media_type: 'movie', id: 157336, title: 'Interestelar', original_title: 'Interstellar', popularity: 40, vote_count: 9000 }
  expect(mergeSearches({ ...none, 'es-MX': [junk] }, 'interstelar', { 'en-US': [real] }).map((r) => r.tmdbId)).toEqual([157336, 1])
})

test('fallbackQueries: the longest word cut at two lengths (TMDB completes the last word) and each other word alone', () => {
  expect(fallbackQueries('el padirno')).toEqual(['el pad', 'el padir'])
  expect(fallbackQueries('breking bad')).toEqual(['bre', 'breki', 'bad'])
  expect(fallbackQueries('interstelar')).toEqual(['inte', 'interst'])
  expect(fallbackQueries('la casa de papel')).toEqual(['la casa de pap', 'casa'])
  expect(fallbackQueries('up')).toEqual([])
})

const nolan = { media_type: 'person', id: 525, name: 'Christopher Nolan', known_for_department: 'Directing', popularity: 20 }
const otherNolan = { media_type: 'person', id: 9, name: 'Nolan North', known_for_department: 'Acting', popularity: 5 }
const darin = { media_type: 'person', id: 69310, name: 'Ricardo Darín', known_for_department: 'Acting', popularity: 8 }

test('pickPerson: the most popular director or actor whose name has every word typed', () => {
  expect(pickPerson({ ...none, 'en-US': [otherNolan, nolan] }, 'nolan')).toEqual({ id: 525, name: 'Christopher Nolan', role: 'director' })
  expect(pickPerson({ ...none, 'es-MX': [darin] }, 'ricardo darin')).toEqual({ id: 69310, name: 'Ricardo Darín', role: 'actor' })
  // Con una parte del nombre, solo si es conocido; con el nombre completo, siempre.
  expect(pickPerson({ ...none, 'es-MX': [darin] }, 'ricardo')).toEqual({ id: 69310, name: 'Ricardo Darín', role: 'actor' })
  const lesser = { ...darin, popularity: 1 }
  expect(pickPerson({ ...none, 'es-MX': [lesser] }, 'darin')).toBeNull()
  expect(pickPerson({ ...none, 'es-MX': [lesser] }, 'Ricardo Darín')).toMatchObject({ id: 69310 })
  expect(pickPerson({ ...none, 'es-MX': [darin] }, 'el secreto de sus ojos')).toBeNull()
  const writer = { ...nolan, known_for_department: 'Writing' }
  expect(pickPerson({ ...none, 'en-US': [writer] }, 'nolan')).toBeNull()
  const unknown = { media_type: 'person', id: 3, name: 'Matrix Naovaratpong', known_for_department: 'Acting', popularity: 0.3 }
  expect(pickPerson({ ...none, 'en-US': [unknown] }, 'matrix')).toBeNull()
})

test('personTitles: what they directed (or created), or acted in, most voted first, without talk shows or playing themselves', () => {
  const credits = {
    crew: [
      { media_type: 'movie', id: 157336, job: 'Director', title: 'Interstellar', original_title: 'Interstellar', release_date: '2014-11-05', vote_count: 30000, genre_ids: [] },
      { media_type: 'movie', id: 27205, job: 'Director', title: 'El origen', original_title: 'Inception', release_date: '2010-07-15', vote_count: 35000, genre_ids: [] },
      { media_type: 'movie', id: 27205, job: 'Writer', title: 'El origen', vote_count: 35000, genre_ids: [] },
      { media_type: 'movie', id: 1, job: 'Producer', title: 'Otra', vote_count: 99999, genre_ids: [] },
      { media_type: 'tv', id: 1431, job: 'Director', name: 'CSI', vote_count: 99999, genre_ids: [] },
      { media_type: 'tv', id: 5, job: 'Creator', name: 'Su serie', vote_count: 10, genre_ids: [] },
    ],
    cast: [{ media_type: 'tv', id: 2, name: 'Talk show', character: 'Self', popularity: 99, genre_ids: [10767] }],
  }
  expect(personTitles(credits, 'director').map((r) => [r.tmdbId, r.title])).toEqual([
    [27205, 'El origen'],
    [157336, 'Interstellar'],
    [5, 'Su serie'],
  ])
  const acting = {
    cast: [
      { media_type: 'movie', id: 25376, character: 'Benjamín Espósito', title: 'El secreto de sus ojos', vote_count: 3000, genre_ids: [18] },
      { media_type: 'tv', id: 3, character: 'Self - Guest', name: 'Late show', vote_count: 50, episode_count: 9, genre_ids: [35] },
      { media_type: 'tv', id: 4, character: 'Ricardo', name: 'Un talk', vote_count: 40, episode_count: 9, genre_ids: [10767] },
      { media_type: 'tv', id: 6, character: 'Juan Salvo', name: 'El Eternauta', vote_count: 500, episode_count: 6, genre_ids: [18] },
      { media_type: 'tv', id: 7, character: 'Invitado', name: 'Una serie', vote_count: 9000, episode_count: 1, genre_ids: [18] },
    ],
  }
  expect(personTitles(acting, 'actor').map((r) => r.tmdbId)).toEqual([25376, 6])
})

test('parseDetailsRequest: up to 20 movies or series by id', () => {
  expect(parseDetailsRequest({ details: [{ mediaType: 'movie', tmdbId: 1 }, { mediaType: 'tv', tmdbId: 2 }] })).toEqual([
    { mediaType: 'movie', tmdbId: 1 },
    { mediaType: 'tv', tmdbId: 2 },
  ])
  for (const body of [{ details: [] }, { details: [{ mediaType: 'person', tmdbId: 1 }] }, { details: [{ mediaType: 'tv', tmdbId: -1 }] }, { details: 'x' }, null]) {
    expect(parseDetailsRequest(body)).toBeNull()
  }
  expect(parseDetailsRequest({ details: Array.from({ length: 21 }, (_, i) => ({ mediaType: 'movie', tmdbId: i + 1 })) })).toBeNull()
})

test('personTitles: up to 100, so the list can grow with "Ver más"', () => {
  const crew = Array.from({ length: 130 }, (_, i) => ({ media_type: 'movie', id: i + 1, job: 'Director', title: `Peli ${i}`, vote_count: i, genre_ids: [] }))
  expect(personTitles({ crew }, 'director')).toHaveLength(100)
})

test('searchExtra: director, seasons, runtime and the IMDb score', () => {
  const movie = { runtime: 103, imdb_id: 'tt0099785', credits: { crew: [{ job: 'Director', name: 'Chris Columbus' }] } }
  const omdb = { Ratings: [{ Source: 'Internet Movie Database', Value: '7.7/10' }] }
  expect(searchExtra(movie, omdb)).toEqual({ director: 'Chris Columbus', seasons: null, runtime: 103, imdb: '7.7/10' })
  const series = { number_of_seasons: 5, created_by: [{ name: 'Vince Gilligan' }], last_episode_to_air: { runtime: 47 } }
  expect(searchExtra(series, null)).toEqual({ director: 'Vince Gilligan', seasons: 5, runtime: 47, imdb: null })
  expect(searchExtra(movie, { Response: 'False', Error: 'Request limit reached!' }).imdb).toBeNull()
})
