import { TestBed, inject } from '@angular/core/testing';

import { SongsService } from './songs.service';

describe('SongsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SongsService]
    });
  });

  it('should be created', inject([SongsService], (service: SongsService) => {
    expect(service).toBeTruthy();
  }));
});
