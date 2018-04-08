import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PointsComponent } from './points.component';

describe('PointsComponent', () => {
  let component: PointsComponent;
  let fixture: ComponentFixture<PointsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PointsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PointsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
