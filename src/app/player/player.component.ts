import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core'
import { Observable, Subscription } from 'rxjs'
import { PlayerService } from './player.service'
import { Song } from '../songs/song.interface';

@Component({
  selector: 'Player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements OnChanges {
  @Input() currentSong: Song
  public points: number = 0
  public lines: string[] = []
  public onLyricsTimeUpdate = new EventEmitter<number>()
  public onSpeechStart = new EventEmitter<boolean>()
  private readonly POINTS_MULTIPLIER = 5

  constructor(
    private PlayerService: PlayerService
  ) {}

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.PlayerService.hasPropertyChanged(changes.currentSong)) {
      this.resetPlayer()
    }
  }

  resetPlayer() {
    this.points = 0
    this.lines = []
  }

  handleAudioPlayPause(isPlaying: boolean) {
    this.onSpeechStart.emit(isPlaying)
  }

  handleAudioTimeUpdate = (time: number) => {
    this.onLyricsTimeUpdate.emit(time)
  }

  handleLyricsNewLine = (line) => {
    // Keep up to last 5 lines in array
    this.lines = [line].concat(this.lines).slice(0, 5)
  }

  handleSpeechFound(text: string) {
    console.log('[speech match]: ', text)
    const matches = this.PlayerService.countMatches(text, this.lines)

    this.points += (matches * this.POINTS_MULTIPLIER)
  }

}
