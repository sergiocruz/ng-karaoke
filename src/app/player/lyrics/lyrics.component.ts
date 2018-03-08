import { Component, EventEmitter, Input, OnInit, Output, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Http, Response } from '@angular/http'
import { Subscription } from 'rxjs';
import * as LRC from 'lrc.js'

import { LyricLRC } from './LyricLRC.interface'
import { PlayerService } from '../player.service';

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
  public currentLine: string = ''

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
    this.currentLine = ''
    this.onLoad.emit()
  }

  handleUpdateTime = (currentTime: number) => {
    this.getCurrentLine(currentTime)
  }

  getCurrentLine = (currentTime: number) => {
    currentTime += this.delay
    const { lines } = this.lyrics
    const lineIndex = lines.findIndex((line) => (line.time >= currentTime))
    const previousLine = this.currentLine

    this.currentLine = (lineIndex > 0)
      ? lines[lineIndex - 1].text
      : ''

    if (this.currentLine && this.currentLine !== previousLine) {
      this.onNewLine.emit(this.currentLine)
    }
  }

}
