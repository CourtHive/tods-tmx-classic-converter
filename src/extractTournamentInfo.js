import { getIndoorOutdoor, getSurface } from './utilities';
import {
  participantConstants,
  participantRoles,
  utilities,
} from 'tods-competition-factory';
import { format } from 'date-fns';

/*
organisation = club
organizers
location
*/

export function extractTournamentInfo({ tournament, file }) {
  const tournamentId = tournament.tuid;
  const organisationId = tournament.org?.ouid;

  const venues = getLocations(tournament);
  const surfaceCategory = getSurface(tournament);
  const indoorOutdoor = getIndoorOutdoor(tournament);
  const onlineResources = getOnlineResources(tournament);

  const tournamentInfo = {
    tournamentId,
    tournamentName: tournament.name,
    startDate:
      tournament.start &&
      new Date(format(new Date(tournament.start), 'yyyy-MM-dd')).toISOString(),
    endDate:
      tournament.end &&
      new Date(format(new Date(tournament.end), 'yyyy-MM-dd')).toISOString(),
    parentOrganisationId: organisationId,
    unifiedTournamentId: {
      tournamentId,
      organisationId,
      organisationName: tournament.org?.name,
      organisationAbbreviation: tournament.org?.abbr,
    },
  };
  if (venues) tournamentInfo.venues = venues;
  if (tournament.notes) tournamentInfo.notes = tournament.notes;
  if (indoorOutdoor) tournamentInfo.indoorOutdoor = indoorOutdoor;
  if (onlineResources) tournamentInfo.onlineResources = onlineResources;
  if (surfaceCategory) tournamentInfo.surfaceCategory = surfaceCategory;

  const organisationParticipants = [
    getRefereeParticipant(tournament.judge),
    (tournament.umpires || []).map(umpire => getRefereeParticipant(umpire)),
  ].filter(Boolean);
  return { tournamentInfo, organisationParticipants };
}

function getOnlineResources(tournament) {
  const social = tournament.media?.social || {};
  const sponsorImages = tournament.publishing?.sponsors || [];

  const onlineResources = Object.keys(social).map(provider => {
    const identifier = social[provider];
    const onlineResource = {
      provider,
      identifier,
      type: 'SOCIAL_MEDIA',
    };
    return onlineResource;
  });

  sponsorImages?.forEach(identifier => {
    const onlineResource = {
      identifier,
      type: 'SPONSOR',
      subType: 'LOGO',
    };
    onlineResources.push(onlineResource);
  });

  return onlineResources;
}

function getLocations(tournament) {
  const range = (start, end) =>
    Array.from({ length: end - start }, (v, k) => k + start);
  const venues = (tournament.locations || []).map(location => {
    const venueId = location.luid;
    const venueAbbreviation = location.abbreviation;
    const courts = range(0, parseInt(location.courts)).map(index => {
      const identifiers =
        location.identifiers && location.identifiers.split(',');
      const identifier = identifiers[index] || index + 1;
      const courtName = `${venueAbbreviation} ${identifier}`;
      const courtNumber = index + 1;
      const court = {
        courtId: `${venueId}|${courtNumber}`,
        courtNumber,
        courtName,
      };
      return court;
    });
    const venue = {
      courts,
      venueId,
      venueAbbreviation,
      venueName: location.name,
      addresses: [
        {
          addressType: 'VENUE',
          latitude: location.latitide,
          longitude: location.longitude,
          addressLine1: location.address,
        },
      ],
    };
    return venue;
  });
  return venues;
}

function getRefereeParticipant(referee) {
  if (!referee) return;
  const [standardGivenName, standardFamilyName] = referee.split(' ');

  const participantId = utilities.UUID();
  return {
    participantName: referee,
    participantId,
    participantType: participantConstants.INDIVIDUAL,
    participantRole: participantRoles.OFFICIAL,
    person: {
      personId: participantId,
      standardFamilyName,
      standardGivenName,
    },
  };
}
