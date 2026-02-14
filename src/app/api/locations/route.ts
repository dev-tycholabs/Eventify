import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/locations?type=countries
// GET /api/locations?type=states&country_id=101
// GET /api/locations?type=cities&state_id=4030
// GET /api/locations?type=city_search&q=Del  (search cities by name)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const supabase = createServerClient();

        if (type === "city_search") {
            const q = searchParams.get("q");
            if (!q || q.length < 2) {
                return NextResponse.json([]);
            }

            const { data: cities, error } = await supabase
                .from("cities")
                .select("id, name, state_id, country_id")
                .ilike("name", `${q}%`)
                .limit(20);

            if (error) throw error;
            if (!cities || cities.length === 0) return NextResponse.json([]);

            // Resolve state and country names for display
            const stateIds = [...new Set(cities.map((c) => c.state_id))];
            const countryIds = [...new Set(cities.map((c) => c.country_id))];

            const [statesRes, countriesRes] = await Promise.all([
                supabase.from("states").select("id, name").in("id", stateIds),
                supabase.from("countries").select("id, name").in("id", countryIds),
            ]);

            const stateMap: Record<number, string> = {};
            if (statesRes.data) {
                for (const s of statesRes.data) stateMap[s.id] = s.name;
            }
            const countryMap: Record<number, string> = {};
            if (countriesRes.data) {
                for (const c of countriesRes.data) countryMap[c.id] = c.name;
            }

            const results = cities.map((c) => ({
                id: c.id,
                name: c.name,
                state: stateMap[c.state_id] || "",
                country: countryMap[c.country_id] || "",
            }));

            return NextResponse.json(results);
        }

        if (type === "countries") {
            const { data, error } = await supabase
                .from("countries")
                .select("id, name")
                .order("name");

            if (error) throw error;
            return NextResponse.json(data);
        }

        if (type === "states") {
            const countryId = searchParams.get("country_id");
            if (!countryId) {
                return NextResponse.json(
                    { error: "country_id is required" },
                    { status: 400 }
                );
            }

            const { data, error } = await supabase
                .from("states")
                .select("id, name")
                .eq("country_id", Number(countryId))
                .order("name");

            if (error) throw error;
            return NextResponse.json(data);
        }

        if (type === "cities") {
            const stateId = searchParams.get("state_id");
            if (!stateId) {
                return NextResponse.json(
                    { error: "state_id is required" },
                    { status: 400 }
                );
            }

            const { data, error } = await supabase
                .from("cities")
                .select("id, name")
                .eq("state_id", Number(stateId))
                .order("name");

            if (error) throw error;
            return NextResponse.json(data);
        }

        return NextResponse.json(
            { error: "Invalid type. Use: countries, states, or cities" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Location API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch locations" },
            { status: 500 }
        );
    }
}
