import CoreLocation
import ExpoModulesCore
import MapKit

/// Apple Maps place search for the location picker: the same venues people
/// find in Apple Maps, ranked near where they are. Free, no API key.
///
/// Every function resolves (never rejects): no results or a MapKit error
/// come back as an empty list, and the JS side falls back to Photon.
public class SudsPlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SudsPlaceSearch")

    /// Venues and addresses matching what the person typed. With a position,
    /// results are biased to ~25 km around it, so "Fairmont" finds the hotel
    /// down the street before the town in West Virginia.
    AsyncFunction("search") { (query: String, lat: Double?, lng: Double?) async -> [[String: Any]] in
      let center = Self.coordinate(lat, lng)
      return await Self.search(query: query, near: center)
    }

    /// Venues (bars, restaurants, hotels, …) within `radius` metres of a
    /// point, nearest first. Lets people pick where they are when GPS lands
    /// on the wrong building.
    AsyncFunction("nearby") { (lat: Double, lng: Double, radius: Double) async -> [[String: Any]] in
      return await Self.nearby(center: CLLocationCoordinate2D(latitude: lat, longitude: lng), radius: radius)
    }
  }

  private static func coordinate(_ lat: Double?, _ lng: Double?) -> CLLocationCoordinate2D? {
    guard let lat, let lng, CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: lat, longitude: lng)) else {
      return nil
    }
    return CLLocationCoordinate2D(latitude: lat, longitude: lng)
  }

  /// Kinds of places people drink at, or near.
  private static let drinkingVenues: [MKPointOfInterestCategory] = [
    .nightlife, .brewery, .winery, .restaurant, .cafe, .hotel, .foodMarket, .bakery,
    .stadium, .theater, .movieTheater, .amusementPark, .beach, .park, .marina, .airport,
  ]

  @MainActor
  private static func search(query: String, near center: CLLocationCoordinate2D?) async -> [[String: Any]] {
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return [] }

    let request = MKLocalSearch.Request()
    request.naturalLanguageQuery = trimmed
    request.resultTypes = [.pointOfInterest, .address]
    if let center {
      request.region = MKCoordinateRegion(center: center, latitudinalMeters: 50_000, longitudinalMeters: 50_000)
    }
    do {
      let response = try await MKLocalSearch(request: request).start()
      return response.mapItems.prefix(15).map { serialize($0, from: center) }
    } catch {
      return [] // includes MKError.placemarkNotFound (no matches)
    }
  }

  @MainActor
  private static func nearby(center: CLLocationCoordinate2D, radius: Double) async -> [[String: Any]] {
    guard CLLocationCoordinate2DIsValid(center) else { return [] }
    let request = MKLocalPointsOfInterestRequest(center: center, radius: max(25, min(radius, 1_000)))
    request.pointOfInterestFilter = MKPointOfInterestFilter(including: drinkingVenues)
    do {
      let response = try await MKLocalSearch(request: request).start()
      return response.mapItems
        .map { serialize($0, from: center) }
        .sorted { ($0["distance"] as? Double ?? .infinity) < ($1["distance"] as? Double ?? .infinity) }
        .prefix(15)
        .map { $0 }
    } catch {
      return []
    }
  }

  private static func serialize(_ item: MKMapItem, from center: CLLocationCoordinate2D?) -> [String: Any] {
    let placemark = item.placemark
    let coordinate = placemark.coordinate
    var out: [String: Any] = [
      "name": item.name ?? placemark.name ?? "",
      "lat": coordinate.latitude,
      "lng": coordinate.longitude,
      // A named place (bar, hotel, …) rather than a street address.
      "isVenue": item.pointOfInterestCategory != nil,
    ]
    let street = [placemark.subThoroughfare, placemark.thoroughfare].compactMap { $0 }.joined(separator: " ")
    if !street.isEmpty { out["street"] = street }
    if let road = placemark.thoroughfare { out["road"] = road }
    if let houseNumber = placemark.subThoroughfare { out["houseNumber"] = houseNumber }
    if let neighbourhood = placemark.subLocality { out["neighbourhood"] = neighbourhood }
    if let city = placemark.locality { out["city"] = city }
    if let region = placemark.administrativeArea { out["region"] = region }
    if let country = placemark.country { out["country"] = country }
    if let category = item.pointOfInterestCategory { out["category"] = category.rawValue }
    if let center {
      let distance = CLLocation(latitude: center.latitude, longitude: center.longitude)
        .distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
      out["distance"] = distance
    }
    return out
  }
}
