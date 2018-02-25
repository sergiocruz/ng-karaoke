import { Injectable } from '@angular/core';

@Injectable()
export class PlayerService {

  constructor() {}

  formatTime(secs) {
    const secsNum = parseInt(secs, 10)
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
