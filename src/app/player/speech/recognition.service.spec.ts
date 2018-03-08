import { TestBed, inject } from '@angular/core/testing';

import { RecognitionService } from './recognition.service';

describe('RecognitionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RecognitionService]
    });
  });

  it('should be created', inject([RecognitionService], (service: RecognitionService) => {
    expect(service).toBeTruthy();
  }));
});
