import axios from 'axios'
import { chromium } from 'playwright-chromium'
import fs from 'fs'
import { twitter } from './config/twitter'

const tags = 'greyscale+monochrome+grey+grayscale+cyberpunk'
const startUrl = `https://dribbble.com/search/shots/recent?q=${tags}`

const getAuthorUrl = (path: string) => `https://dribbble.com${path}/about`

const updateStatus = (shot: any, media: any) => {
  return twitter.post(
    'statuses/update',
    {
      status: `${shot.title} by ${shot.author} ${shot.twitterHandle}\n\n#design #dribbble #monochrome #grayscale`,
      media_ids: media.media_id_string,
    },
    function (err: any, tweet: any, response: any) {
      if (err) throw err
    }
  )
}

const postTweet = async (shot: any, media: any) => {
  return twitter.post(
    'media/upload',
    { media },
    function (err: Error, media: any, response: any) {
      if (err) throw err
      return updateStatus(shot, media)
    }
  )
}

const getShot = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(startUrl)

  const item = await page
    .$$eval('.shot-thumbnail', (shots) => {
      return shots
        .map((shot): {
          title?: string | null
          author?: string | null
          authorUrl?: string | null
          imageUrl?: string | null
          twitterHandle?: string | null
        } => ({
          title: shot.querySelector('.shot-title')?.textContent,
          author: shot.querySelector('.display-name')?.textContent,
          authorUrl: shot
            .querySelector('.user-information > .url')
            ?.getAttribute('href'),
          imageUrl: shot
            .querySelector('.shot-thumbnail-placeholder > img')
            ?.getAttribute('src')
            ?.split('?')[0],
        }))
        .filter((item) => item.title)
    })
    .then((items) => items[Math.floor(Math.random() * items.length)])

  const getTwitterHandle = async (authorUrl: string) => {
    const url = getAuthorUrl(authorUrl)
    await page.goto(url)

    try {
      const path = "head > meta[name='twitter:creator']"
      return await page.$eval(path, (e) => (e as HTMLMetaElement).content)
    } catch {
      return null
    }
  }

  if (item.authorUrl) {
    item.twitterHandle = await getTwitterHandle(item.authorUrl)
  }

  await browser.close()

  return item
}

const downloadImage = async (url: string) => {
  return axios
    .get(url, {
      responseType: 'arraybuffer',
    })
    .then((response) => Buffer.from(response.data, 'binary'))
}

;(async () => {
  const shot = await getShot()

  if (!shot.imageUrl || !shot.twitterHandle) {
    throw new Error('Not enough data to post')
  }

  const image = await downloadImage(shot.imageUrl)

  fs.writeFile('./image.jpg', image, () => {
    const data = fs.readFileSync('image.jpg')
    return postTweet(shot, data)
  })
})()
