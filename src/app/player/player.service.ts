import { SimpleChange } from '@angular/core'
import { Injectable } from '@angular/core';

@Injectable()
export class PlayerService {

  /**
   * Alpha & space character regex
   *
   * @private
   * @readonly
   * @type {RegExp}
   * @memberOf PlayerService
   */
  private readonly ALPHA_REGEX: RegExp = /[^a-z\s]/gi

  /**
   * Defines if whether or not a property has changed
   * and that it is not during component's first load.
   *
   * @param {SimpleChange} change
   * @returns {boolean}
   *
   * @memberOf PlayerService
   */
  hasPropertyChanged(change: SimpleChange): boolean {
    return !change.firstChange && change.previousValue !== change.currentValue
  }

  /**
   * Formats seconds into readable [hh:]?mm:ss format
   *
   * @param {number|string} secs
   * @returns {string} Formatted string
   *
   * @memberOf PlayerService
   */
  formatTime(secs: number|string): string {
    const secsNum = parseInt(secs.toString(), 10)
    const hours = Math.floor(secsNum / 3600) % 24
    const minutes = Math.floor(secsNum / 60) % 60
    const seconds = secsNum % 60

    return [hours, minutes, seconds]
      .map((num) => (num < 10)
        ? '0' + num
        : num
      )
      .filter((num, i) => (
        (num !== '00') || (i > 0))
      )
      .join(':')
  }

  /**
   * Calculates number of word matches between speech and last 5 lines of lyrics
   *
   * @param {string} speech Spoken text
   * @param {string[]} lines Last 5 lines of song lyrics
   * @returns {number} Number of exact matches found
   *
   * @memberOf PlayerService
   */
  countMatches(speech: string, lines: string[]): number {
    const speechWordsList = speech.replace(this.ALPHA_REGEX, '').split(' ')
    const linesWordsList = lines
      .map((line) => line.replace(this.ALPHA_REGEX, '').split(' '))
      .reduce((a, b) => a.concat(b), [])
    let matches = 0

    linesWordsList.forEach((word) => {
      const indexInSpeech = speechWordsList.findIndex((w) => w === word)

      if (indexInSpeech >= 0) {
        // remove word from list
        speechWordsList.splice(indexInSpeech, 1)

        // increase number of matches
        matches++
      }
    })



    return matches
  }

}
