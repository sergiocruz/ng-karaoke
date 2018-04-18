import { Injectable } from '@angular/core';

import { Song } from './song.interface'

@Injectable()
export class SongsService {

  constructor() { }

  private readonly songList: Song[] = [
    {
      artist: 'Rick Astley',
      title: 'Never Gonna Give You Up',
      audio: 'assets/songs/never-gonna-give-you-up/never-gonna-give-you-up.mp3',
      lyrics: 'assets/songs/never-gonna-give-you-up/never-gonna-give-you-up.lrc',
      lyricDelay: 1,
    },
    {
      artist: 'Journey',
      title: 'Don\'t Stop Believing',
      audio: 'assets/songs/dont-stop-believing/dont-stop-believing.mp3',
      lyrics: 'assets/songs/dont-stop-believing/dont-stop-believing.lrc',
      lyricDelay: 1,
    },
  ]

  getSongList() {
    return this.songList
  }

}
