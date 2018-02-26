import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http'

import { AppComponent } from './app.component';
import { PlayerComponent } from './player/player.component';
import { PlayerService } from './player/player.service';
import { AudioComponent } from './player/audio/audio.component';
import { LyricsComponent } from './player/lyrics/lyrics.component'


@NgModule({
  declarations: [
    AppComponent,
    PlayerComponent,
    AudioComponent,
    LyricsComponent
  ],
  imports: [
    BrowserModule,
    HttpModule
  ],
  providers: [
    PlayerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
