import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs'
import { PlayerService } from '../player.service'

@Component({
  selector: 'player-points',
  templateUrl: './points.component.html',
  styleUrls: ['./points.component.css']
})
export class PointsComponent implements OnInit, OnChanges, OnDestroy {

  @Input('points') playerPoints: number = 0;
  public points = 0
  public hasFireworks = false
  private value$: Subject<number> = new Subject()
  private lerpSubscription: Subscription
  private timeout

  constructor(
    private PlayerService: PlayerService
  ) {}

  ngOnInit() {
    this.lerpSubscription = this.PlayerService
      .pointsAnimator(this.value$)
      .subscribe((points) => this.points = points)
  }

  ngOnChanges(changes: SimpleChanges): void {
    const { playerPoints } = changes

    if (this.PlayerService.hasPropertyChanged(playerPoints) && playerPoints.currentValue > 0) {
      this.value$.next(playerPoints.currentValue)

      this.hasFireworks = true

      this.timeout = setTimeout(
        () => this.hasFireworks = false,
        4000,
      )
    }
  }

  ngOnDestroy(): void {
    this.lerpSubscription.unsubscribe()
    clearTimeout(this.timeout)
  }
}
