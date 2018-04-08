import { SimpleChange } from '@angular/core'
import { Injectable } from '@angular/core';
import { Observable, Scheduler, Subject, Subscription } from 'rxjs'
import { scan, map, withLatestFrom, distinctUntilChanged } from 'rxjs/operators'

const { Metaphone, SoundEx } = window['natural']

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
   *
   * Double spaces regex
   *
   * @private
   * @type {RegExp}
   * @memberOf PlayerService
   */
  private readonly DOUBLESPACES_REGEX: RegExp = /\s\s+/g

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
    let matches = 0

    const speechWordsList = speech
      .trim()
      .toLowerCase()
      .replace(this.ALPHA_REGEX, '')
      .replace(this.DOUBLESPACES_REGEX, ' ')
      .split(' ')

    const linesWordsList = lines
      .map((line) => line
        .trim()
        .toLowerCase()
        .replace(this.ALPHA_REGEX, '')
        .replace(this.DOUBLESPACES_REGEX, ' ')
        .split(' ')
      )
      .reduce((a, b) => a.concat(b), [])

    // Goes through each word in speech and tries to find a match in lyric lines
    speechWordsList.forEach((wordFromSpeech) => {
      const indexInLyrics = linesWordsList.findIndex(
        (wordFromLyrics) => wordFromSpeech === wordFromLyrics
          || Metaphone.compare(wordFromSpeech, wordFromLyrics)
          || SoundEx.compare(wordFromSpeech, wordFromLyrics)
      )

      if (indexInLyrics >= 0) {
        // console.log('match', wordFromSpeech, linesWordsList[indexInLyrics])
        // remove word from list
        linesWordsList.splice(indexInLyrics, 1)

        // increase number of matches
        matches++
      }
    })

    return matches
  }

  pointsAnimator(value$: Subject<number>) {
    const tick$ = Observable.interval(0, Scheduler.animationFrame)
    const lerpValue$ = tick$.pipe(
      withLatestFrom(value$, (_, value) => value),
      scan(
        (prev, current) => prev + (current - prev) * .05,
        0
      ),
      map((n) => Math.round(n)),
      distinctUntilChanged()
    )

    return lerpValue$
  }

}
