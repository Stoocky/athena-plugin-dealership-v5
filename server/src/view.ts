import * as alt from 'alt-server';
import * as Athena from '@AthenaServer/api';
import { VehicleInfo } from '@AthenaShared/interfaces/vehicleInfo';
import { DEALERSHIP_EVENTS } from '../../shared/events';
import { IDealership } from '../../shared/interfaces';
import { DEALERSHIP_LOCALE } from '../../shared/locale';

const dealerships: Array<IDealership> = [];
let inDealership: { [key: string]: string } = {};

class InternalFunctions {
    /**
     * It creates a blip, marker, and interaction for a dealership
     * @param {IDealership} dealership - IDealership - This is the dealership object that is being
     * passed to the function.
     */
    static propogate(dealership: IDealership) {
        Athena.controllers.interaction.append({
            uid: dealership.uid,
            description: dealership.name,
            isPlayerOnly: true,
            position: dealership.pos,
            range: 3,
            callback: (player: alt.Player) => {
                DealershipView.load(player, dealership);
            },
        });

        Athena.controllers.blip.append({
            uid: dealership.uid,
            color: 43, // Light Green
            text: dealership.name,
            pos: dealership.pos,
            shortRange: true,
            scale: 1,
            sprite: 669,
        });

        Athena.controllers.marker.append({
            uid: dealership.uid,
            type: 36,
            color: new alt.RGBA(0, 255, 0, 100),
            pos: new alt.Vector3(dealership.pos.x, dealership.pos.y, dealership.pos.z + 0.5),
            maxDistance: 25,
            scale: new alt.Vector3(1, 1, 1),
        });

        Athena.controllers.textLabel.append({
            text: dealership.name,
            pos: dealership.pos,
            uid: dealership.uid,
            maxDistance: 10,
        });
    }
}

let isInitialized = false;

export class DealershipView {
    static init() {
        if (isInitialized) {
            return;
        }

        isInitialized = true;
        alt.onClient(DEALERSHIP_EVENTS.PURCHASE, DealershipView.purchase);
    }

    /**
     * Add a dealership to the dealerships array and then propogate the dealership to the other
     * functions.
     * @param {IDealership} dealership - IDealership - This is the dealership that is being added to
     * the list.
     */
    static add(dealership: IDealership) {
        dealerships.push(dealership);
        InternalFunctions.propogate(dealership);
    }

    /**
     * If the dealership exists, remove it from the array and return true, otherwise return false.
     * @param {string} uid - string - The unique identifier of the dealership to remove.
     * @returns The return value is a boolean.
     */
    static remove(uid: string): boolean {
        const index = dealerships.findIndex((dealership) => dealership.uid === uid);
        if (index <= -1) {
            return false;
        }

        dealerships.splice(index, 1);
        return true;
    }

    /**
     * It takes a dealership object and loads it into the player's client.
     * @param player - The player who is interacting with the dealership.
     * @param {IDealership} dealership - IDealership
     */
    static load(player: alt.Player, dealership: IDealership) {
        alt.emitClient(player, DEALERSHIP_EVENTS.LOAD, dealership);
        inDealership[player.id] = dealership.uid;
    }

    static purchase(player: alt.Player, vehicle: VehicleInfo, color: number) {
        const playerData = Athena.document.character.get(player);
        if (!inDealership[player.id]) {
            Athena.player.emit.soundFrontend(player, 'Hack_Failed', 'DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS');
            return;
        }

        const dealership = dealerships.find((x) => x.uid === inDealership[player.id]);
        delete inDealership[player.id];

        if (!dealership) {
            Athena.player.emit.soundFrontend(player, 'Hack_Failed', 'DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS');
            return;
        }

        const vehicleInfo = dealership.vehicles.find((x) => x.name === vehicle.name);
        if (!vehicleInfo || !vehicleInfo.sell) {
            Athena.player.emit.message(player, DEALERSHIP_LOCALE.INVALID_MODEL);
            Athena.player.emit.soundFrontend(player, 'Hack_Failed', 'DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS');
            return;
        }

        if (playerData.bank + playerData.cash < vehicleInfo.price) {
            Athena.player.emit.message(player, DEALERSHIP_LOCALE.NOT_ENOUGH_MONEY);
            Athena.player.emit.soundFrontend(player, 'Hack_Failed', 'DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS');
            return;
        }

        if (!Athena.player.currency.subAllCurrencies(player, vehicleInfo.price)) {
            Athena.player.emit.message(player, DEALERSHIP_LOCALE.NOT_ENOUGH_MONEY);
            Athena.player.emit.soundFrontend(player, 'Hack_Failed', 'DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS');
            return;
        }

        Athena.vehicle.add.toDatabase(playerData._id.toString(), vehicleInfo.name, { x: -53.617584228515625, y: -1117.107666015625, z: 25.942529296875 });

        Athena.player.emit.notification(player, DEALERSHIP_LOCALE.VEHICLE_MOVED_TO_NEAREST_GARAGE);
        const name = vehicleInfo.name;
        Athena.player.events.trigger<'PURCHASED_VEHICLE'>('PURCHASED_VEHICLE', player, name);

        Athena.player.emit.sound2D(player, 'item_purchase');
    }
}
