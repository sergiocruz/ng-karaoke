import { Component, EventEmitter, Input, OnInit, Output, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Http, Response } from '@angular/http'
import { Subscription } from 'rxjs';
import * as LRC from 'lrc.js'

import { LyricLRC } from './LyricLRC.interface'
import { PlayerService } from '../player.service';

export interface Line {
  index: number,
  text: string,
}

@Component({
  selector: 'player-lyrics',
  templateUrl: './lyrics.component.html',
  styleUrls: ['./lyrics.component.css']
})
export class LyricsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() src: string = ''
  @Input() delay: number = 0
  @Input() onCurrentTimeUpdate: EventEmitter<number>
  @Output() onLoad = new EventEmitter()
  @Output() onNewLine = new EventEmitter<string>()
  private timeSubscription: Subscription
  public lyrics: LyricLRC
  public currentLineIndex: number = -1
  public lines: Line[] = []

  constructor(
    private service: PlayerService,
    private Http: Http
  ) { }

  ngOnInit() {
    this.loadLyrics(this.src)
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.service.hasPropertyChanged(changes.src)) {
      this.loadLyrics(changes.src.currentValue)
    }
  }

  ngOnDestroy() {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe()
    }
  }

  loadLyrics(src) {
    this.Http
      .get(src)
      .subscribe((response: Response) => {
        this.processLyrics(response.text())
        this.timeSubscription = this.onCurrentTimeUpdate.subscribe(this.handleUpdateTime)
      })
  }

  processLyrics(lrcText) {
    this.lyrics = LRC.parse(lrcText)
    this.currentLineIndex = -1
    this.lines = []
    this.onLoad.emit()
  }

  handleUpdateTime = (currentTime: number) => {
    this.getCurrentLine(currentTime)
  }

  getCurrentLine = (currentTime: number) => {
    currentTime += this.delay
    const { lines } = this.lyrics
    const lineIndex = lines.findIndex((line) => (line.time >= currentTime))
    const previousLine = lines[this.currentLineIndex]
    const nextLine = lines[lineIndex]
    const currentLineIndex = (lineIndex - 1)
    const currentLine = (lineIndex > 0)
      ? lines[currentLineIndex]
      : null


    if (currentLine && currentLine !== previousLine) {
      this.currentLineIndex = currentLineIndex
      this.onNewLine.emit(currentLine.text)

      if (!this.lines.length) {
        this.lines.push({ index: currentLineIndex, text: currentLine.text })
      }

      if (nextLine) {
        const lines = this.lines.concat([ { index: lineIndex, text: nextLine.text } ])

        if (lines.length >= 4) {
          lines.shift()
        }

        this.lines = lines
      }
    }
  }

}
