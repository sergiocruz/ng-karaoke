import { Injectable } from '@angular/core'

@Injectable()
export class RecognitionService {

  private static recognition: SpeechRecognition

  constructor() {}

  getRecognition(): SpeechRecognition {
    if (RecognitionService.recognition) {
      return RecognitionService.recognition
    }

    const recognition = new (window['SpeechRecognition'] || window['webkitSpeechRecognition'] || window['mozSpeechRecognition'] || window['msSpeechRecognition'])() as SpeechRecognition
    recognition.continuous = true
    recognition.interimResults = true

    return recognition
  }
}
