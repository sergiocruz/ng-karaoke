import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, Output, SimpleChanges } from '@angular/core'
import { Observable, Subscription } from 'rxjs'
import { PlayerService } from './player.service'

@Component({
  selector: 'Player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements AfterViewInit, OnDestroy {

  @Output() onTimeUpdate = new EventEmitter<HTMLMediaElementEventMap>()
  @Input() src: string = ''
  private audio: HTMLAudioElement
  private timeSubscription: Subscription
  private loadSubscription: Subscription
  public paused: boolean = false
  public currentTime: string
  public duration: string

  constructor(private service: PlayerService ) {
    this.audio = new Audio()
    this.currentTime = service.formatTime(0)
    this.duration = service.formatTime(0)
  }

  ngAfterViewInit() {
    // Loads new audio source
    this.loadAudioSource(this.src)

    // Subscribes timeupdate
    this.timeSubscription = Observable
      .fromEvent(this.audio, 'timeupdate')
      .subscribe(this.handleAudioTimeUpdate)

    // Subscribe to loaded event
    this.loadSubscription = Observable
      .fromEvent(this.audio, 'loadeddata')
      .subscribe(this.handleAudioLoaded)
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.src.previousValue !== changes.src.currentValue) {
      this.loadAudioSource(changes.src.currentValue)
    }
  }

  ngOnDestroy() {
    // Unsubscribe
    this.timeSubscription.unsubscribe()
    this.loadSubscription.unsubscribe()

    // Destroy audio tag
    this.loadAudioSource('')
    this.audio.load()
  }

  initAudio(): HTMLAudioElement {
    const audio = new Audio()
    audio['autobuffer'] = true
    audio.autoplay = false
    audio.preload = 'auto'

    return audio
  }

  loadAudioSource(src: string) {
    this.audio.pause()
    this.audio.src = src
  }

  handleAudioLoaded = (e: HTMLMediaElementEventMap) => {
    this.duration = this.service.formatTime(this.audio.duration)
  }

  handleAudioTimeUpdate = (e: HTMLMediaElementEventMap) => {
    this.currentTime = this.service.formatTime(this.audio.currentTime)
    this.onTimeUpdate.emit(e)
  }

  handleAudioPlayPause() {
    if (this.audio.paused) {
      this.audio.play()
      this.paused = true
    } else {
      this.audio.pause()
      this.paused = false
    }
  }
}
