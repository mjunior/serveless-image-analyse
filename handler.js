'use strict';

const { promises: { readFile } } = require('fs')
const { get } = require('axios');

class Handler {

  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }

  async imageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()

    const workItems = result.Labels.filter(( { Confidence }) => Confidence > 90)
    const names = workItems.map(({ Name }) => Name).join(' and ')

    return { names, workItems }
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }
    const { TranslatedText } = await this.translatorSvc.translateText(params).promise()
    return TranslatedText.split(' e ')
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    })

    return Buffer.from(response.data, 'base64')
  }

  formatTextResults(texts, workItems) {
    const finalText = []

    for(const index in texts) {
      const pt = texts[index]
      const item = workItems[index]

      finalText.push(
        `${item.Confidence.toFixed(2)}% de ser ${pt}`
      )
    }

    return finalText.join('\n');
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;
      // const imgBuffer = await readFile('./images/cat.jpg')
      console.log('Download image')
      const imgBuffer = await this.getImageBuffer(imageUrl);
      
      console.log('Detecting labels...')
      const { names, workItems } = await this.imageLabels(imgBuffer)

      console.log('Transalating to Portuguese...')
      const texts = await this.translateText(names)

      console.log('Handling final object...')
      const finalText = this.formatTextResults(texts, workItems);

      console.log('Finishin...')

      return {
        statusCode: 200,
        body: `A Imagem tem \n`.concat(finalText)
      }

    } catch (error) {
      console.log("Error****", error.stack);
      return {
        statusCode: 500,
        body: 'Internal Server Error!'
      }
    }
  }
}

// factory cria todas as instancias e passa as dependencias pra dentro da classe. (DI)
const aws = require('aws-sdk')
const reko = new aws.Rekognition()
const translator = new aws.Translate();
const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator
});

module.exports.main = handler.main.bind(handler)