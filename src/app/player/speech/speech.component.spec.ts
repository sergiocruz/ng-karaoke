import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SpeechComponent } from './speech.component';

describe('SpeechComponent', () => {
  let component: SpeechComponent;
  let fixture: ComponentFixture<SpeechComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SpeechComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SpeechComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
