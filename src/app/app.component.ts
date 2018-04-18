import { Component } from '@angular/core';
import { SongsService } from './songs/songs.service'
import { Song } from './songs/song.interface'
import './natural'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  public songList: Song[] = []
  public currentSong: Song

  constructor(
    private Songs: SongsService
  ) {}

  ngOnInit() {
    this.songList = this.Songs.getSongList()
  }

  handleChooseSong(song: Song) {
    this.currentSong = song
  }

  handleClearCurrentSong() {
    this.currentSong = null
  }
}
