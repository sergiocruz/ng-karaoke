import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, Output, SimpleChanges } from '@angular/core'
import { Observable, Subscription } from 'rxjs'
import { PlayerService } from './player.service'

@Component({
  selector: 'Player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent {

  @Input() audio: string
  @Input() lyrics: string
  @Input() delay: number
  onLyricsTimeUpdate = new EventEmitter<number>()
  onSpeechStart = new EventEmitter<boolean>()

  ngOnInit() {
  }

  handleAudioPlayPause(isPlaying: boolean) {
    this.onSpeechStart.emit(isPlaying)
  }

  handleAudioTimeUpdate = (time: number) => {
    this.onLyricsTimeUpdate.emit(time)
  }

  handleSpeechFound(text: string) {
    console.log('speech match: ', text)
  }

}
