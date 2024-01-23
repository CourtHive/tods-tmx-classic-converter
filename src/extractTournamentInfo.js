import { getIndoorOutdoor, getSurface } from './utilities';
import { format } from 'date-fns';
import {
  participantConstants,
  participantRoles,
  tools,
} from 'tods-competition-factory';

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
    parentOrganisation: {
      organisationAbbreviation: tournament.org?.abbr,
      organisationName: tournament.org?.name,
      organisationId,
    },
  };
  if (venues) tournamentInfo.venues = venues;
  if (tournament.notes) tournamentInfo.notes = tournament.notes;
  if (indoorOutdoor) tournamentInfo.indoorOutdoor = indoorOutdoor;
  if (onlineResources) tournamentInfo.onlineResources = onlineResources;
  if (surfaceCategory) tournamentInfo.surfaceCategory = surfaceCategory;
  if (tournament.latitude && tournament.longitude) {
    tournamentInfo.extensions = [
      {
        name: 'TOURNAMENT_LOCATION',
        value: {
          latitude: tournament.latitude,
          longitude: tournament.longitude,
        },
      },
    ];
  }

  const organisationParticipants = [
    getRefereeParticipant(tournament.judge),
    (tournament.umpires || []).map(umpire => getRefereeParticipant(umpire)),
  ].filter(Boolean);
  return { tournamentInfo, organisationParticipants };
}

function getOnlineResources(tournament) {
  const sponsorImages = tournament.publishing?.sponsors || [];
  const tournamentImage = tournament.publishing?.logo;
  const social = tournament.media?.social || {};

  const onlineResources = Object.keys(social).map(provider => {
    const identifier = social[provider];
    const onlineResource = {
      resourceType: 'SOCIAL_MEDIA',
      resourceSubType: 'WEBSITE',
      name: provider,
      identifier,
      provider,
    };
    return onlineResource;
  });

  if (tournamentImage) {
    const onlineResource = {
      identifier: tournamentImage,
      resourceSubType: 'IMAGE',
      name: 'tournamentImage',
      resourceType: 'URL',
    };
    onlineResources.push(onlineResource);
  }

  sponsorImages?.forEach(identifier => {
    const onlineResource = {
      resourceSubType: 'IMAGE',
      resourceType: 'URL',
      identifier,
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
          latitude: location.latitude,
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

  const participantId = tools.UUID();
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
