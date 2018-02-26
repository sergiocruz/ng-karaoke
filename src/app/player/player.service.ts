import { SimpleChange } from '@angular/core'
import { Injectable } from '@angular/core';

@Injectable()
export class PlayerService {

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

}
