import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http'

import { AppComponent } from './app.component';
import { PlayerComponent } from './player/player.component';
import { PlayerService } from './player/player.service';
import { AudioComponent } from './player/audio/audio.component';
import { LyricsComponent } from './player/lyrics/lyrics.component'
import { SongsService } from './songs/songs.service';
import { SpeechComponent } from './player/speech/speech.component'
import { RecognitionService } from './player/speech/recognition.service';
import { SongSelectionComponent } from './song-selection/song-selection.component';
import { PointsComponent } from './player/points/points.component'

@NgModule({
  declarations: [
    AppComponent,
    PlayerComponent,
    AudioComponent,
    LyricsComponent,
    SpeechComponent,
    SongSelectionComponent,
    PointsComponent
  ],
  imports: [
    BrowserModule,
    HttpModule
  ],
  providers: [
    PlayerService,
    SongsService,
    RecognitionService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
