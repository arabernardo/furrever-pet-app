export type Reaction = 'happy' | 'hearts' | 'play' | 'feed' | 'none'
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Choice {
  label: string
  reply: string
  react: Reaction
}

export interface Prompt {
  kind: 'greeting' | 'checkIn' | 'play' | 'menu'
  text: string
  choices: Choice[]
}

export interface Persona {
  petName: string
  ownerName: string
}

interface Template {
  text: string
  choices: Choice[]
}

// Tokens: {,owner} becomes ", Ara" (or nothing if no name is set), {pet} becomes the pet's name.
const GREETINGS: Record<DayPart, string> = {
  morning: 'Good morning{,owner}! {pet} is up and ready to play!',
  afternoon: 'Good afternoon{,owner}! {pet} missed you!',
  evening: 'Good evening{,owner}! Did you have a nice day?',
  night: 'Still up{,owner}? {pet} will keep you company.',
}

const CHECK_INS: Template[] = [
  {
    text: 'How are you doing today{,owner}?',
    choices: [
      { label: 'Great!', reply: 'Yay! That makes {pet} happy!', react: 'happy' },
      { label: 'Not so good', reply: 'Aww. {pet} is right here with you.', react: 'hearts' },
    ],
  },
  {
    text: 'How is your day going{,owner}?',
    choices: [
      { label: 'Pretty good', reply: 'Woo! Keep it up!', react: 'happy' },
      { label: 'Tiring', reply: 'Take a little break. {pet} will keep watch.', react: 'hearts' },
    ],
  },
  {
    text: 'Did you drink some water{,owner}?',
    choices: [
      { label: 'Yes!', reply: 'Good job!', react: 'happy' },
      { label: 'Not yet', reply: 'Go get some! {pet} will wait.', react: 'none' },
    ],
  },
  {
    text: '{pet} is a little hungry{,owner}. Got a treat?',
    choices: [
      { label: 'Feed', reply: 'Treat time!', react: 'feed' },
      { label: 'Later', reply: 'Okay, {pet} will wait.', react: 'none' },
    ],
  },
]

const PLAY: Template[] = [
  {
    text: 'Wanna play{,owner}?',
    choices: [
      { label: 'Play!', reply: 'Yay! Catch me if you can!', react: 'play' },
      { label: 'Later', reply: 'Okay! {pet} will be right here.', react: 'none' },
    ],
  },
  {
    text: 'Psst{,owner}... want to play with {pet}?',
    choices: [
      { label: 'Sure!', reply: 'Yippee!', react: 'play' },
      { label: 'Busy', reply: 'Okay, good luck with work!', react: 'hearts' },
    ],
  },
]

const NIGHT: Template[] = [
  {
    text: 'It is getting late{,owner}. Time to rest soon?',
    choices: [
      { label: 'Soon', reply: 'Good. Sleep well!', react: 'hearts' },
      { label: 'A bit more', reply: 'Okay, {pet} will stay up with you.', react: 'none' },
    ],
  },
]

export function dayPart(now = new Date()): DayPart {
  const h = now.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
}

function fill(text: string, p: Persona): string {
  return text.replaceAll('{,owner}', p.ownerName ? `, ${p.ownerName}` : '').replaceAll('{pet}', p.petName)
}

let lastText = ''

/** Random template, avoiding the one used last time. */
function pickFresh(list: Template[]): Template {
  const fresh = list.filter((t) => t.text !== lastText)
  const pool = fresh.length > 0 ? fresh : list
  const t = pool[Math.floor(Math.random() * pool.length)]
  lastText = t.text
  return t
}

function build(kind: Prompt['kind'], t: Template, p: Persona): Prompt {
  return { kind, text: fill(t.text, p), choices: t.choices.map((c) => ({ ...c, reply: fill(c.reply, p) })) }
}

export function greetingPrompt(p: Persona, now = new Date()): Prompt {
  return { kind: 'greeting', text: fill(GREETINGS[dayPart(now)], p), choices: [] }
}

/** A random check-in: a "how are you" 60% of the time, otherwise an invitation to play. At night: gentle only. */
export function randomPrompt(p: Persona, now = new Date()): Prompt {
  if (dayPart(now) === 'night') return build('checkIn', pickFresh(NIGHT), p)
  if (Math.random() < 0.6) return build('checkIn', pickFresh(CHECK_INS), p)
  return build('play', pickFresh(PLAY), p)
}

/** Shown when the pet is right-clicked. */
export function menuPrompt(p: Persona): Prompt {
  return {
    kind: 'menu',
    text: fill('What shall we do{,owner}?', p),
    choices: [
      { label: 'Feed', reply: 'Treat time!', react: 'feed' },
      { label: 'Play', reply: 'Yay! Ball time!', react: 'play' },
    ],
  }
}

export interface Offer {
  title: string
  text: string
}

const OFFERS: Offer[] = [
  { title: '{pet} wants to play!', text: 'Got a minute{,owner}? Feed or play with {pet}.' },
  { title: '{pet} is hungry', text: 'How about a treat{,owner}?' },
  { title: 'Break time?', text: '{pet} thinks you deserve a little break{,owner}. Play together?' },
]

/** Text for the notification toast. */
export function offerPrompt(p: Persona): Offer {
  const o = OFFERS[Math.floor(Math.random() * OFFERS.length)]
  return { title: fill(o.title, p), text: fill(o.text, p) }
}
