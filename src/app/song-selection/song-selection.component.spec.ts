import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SongSelectionComponent } from './song-selection.component';

describe('SongSelectionComponent', () => {
  let component: SongSelectionComponent;
  let fixture: ComponentFixture<SongSelectionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SongSelectionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SongSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
