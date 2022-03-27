create table _db_state (schemaVersion integer not null);
insert into
  _db_state (schemaVersion)
values
  (1);
create table station (
  name text unique not null,
  lat float not null,
  lon float not null,
  elev float not null,
  desc text not null
);
create table daily (
  name text not null,
  yyyymmdd text not null,
  tmax float default null,
  tmin float default null,
  unique (name, yyyymmdd)
);
