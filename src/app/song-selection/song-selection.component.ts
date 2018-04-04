import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { Song } from '../songs/song.interface'

@Component({
  selector: 'song-selection',
  templateUrl: './song-selection.component.html',
  styleUrls: ['./song-selection.component.css']
})
export class SongSelectionComponent implements OnInit {

  @Input() songList: Song[]
  @Input() currentSong: Song
  @Output() onChooseSong = new EventEmitter<Song>()

  constructor() { }

  ngOnInit() {
  }

  handleChooseSong($event, song: Song) {
    $event.preventDefault()
    this.onChooseSong.emit(song)
  }

}
