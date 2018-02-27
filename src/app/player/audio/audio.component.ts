import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core'
import { Observable, Subscription } from 'rxjs'
import { PlayerService } from '../player.service'

@Component({
  selector: 'player-audio',
  templateUrl: './audio.component.html',
  styleUrls: ['./audio.component.css']
})
export class AudioComponent implements OnInit, AfterViewInit, OnDestroy {

  @Output() onCurrentTimeUpdate = new EventEmitter<number>()
  @Output() onPlayPause = new EventEmitter<boolean>()
  @Input() src: string = ''
  private audio: HTMLAudioElement
  private timeSubscription: Subscription
  private loadSubscription: Subscription
  public isPlaying: boolean = false
  public currentTime: string
  public duration: string

  constructor(
    private service: PlayerService
  ) {}

  ngOnInit() {
    this.audio = this.initAudio()
    this.currentTime = this.service.formatTime(0)
    this.duration = this.service.formatTime(0)
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

    // Subscribe other events
    this.audio.addEventListener('playing', this.handleAudioPlayed)
    this.audio.addEventListener('pause', this.handleAudioPaused)
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.service.hasPropertyChanged(changes.src)) {
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
    this.handleAudioPaused()
    this.audio.src = src
  }

  handleAudioLoaded = (e: HTMLMediaElementEventMap) => {
    this.duration = this.service.formatTime(this.audio.duration)
  }

  handleAudioTimeUpdate = (e: HTMLMediaElementEventMap) => {
    this.currentTime = this.service.formatTime(this.audio.currentTime)
    this.onCurrentTimeUpdate.emit(this.audio.currentTime)
  }

  handleAudioPlayed = () => {
    this.onPlayPause.emit(true)
    this.isPlaying = true
  }

  handleAudioPaused = () => {
    this.onPlayPause.emit(false)
    this.isPlaying = false
  }

  handleAudioPlayPause() {
    if (this.audio.paused) {
      this.audio.play()
    } else {
      this.audio.pause()
    }
  }

}
