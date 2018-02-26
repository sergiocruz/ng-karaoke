import { Component, Input, OnInit } from '@angular/core';
import { Http } from '@angular/http'

@Component({
  selector: 'player-lyrics',
  templateUrl: './lyrics.component.html',
  styleUrls: ['./lyrics.component.css']
})
export class LyricsComponent implements OnInit {

  @Input() src: string

  constructor(
    private Http: Http
  ) { }

  ngOnInit() {
    this.Http
      .get(this.src)
      .subscribe((res) => console.log('response', res))
  }

}
