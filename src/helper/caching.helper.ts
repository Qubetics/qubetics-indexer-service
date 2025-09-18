import {
	INCREMENT_SUPPLY_BY,
	STATIC_BURNED_AMOUNT,
	STATIC_CIRCULATING_SUPPLY_FIGURE,
} from '../constant/constants';
import { CONST_NAME, REDIS_KEY } from '../constant/response';
import { prisma } from '../lib/db';
import { RedisService } from '../service';

class ProcessHelper {
	async initializeCount() {
		const blockCount = await prisma.blocks.count();
		if (blockCount) {
			RedisService.setString(REDIS_KEY.BLOCKS_COUNT, blockCount);
		}

		const txCount = await prisma.transactions.count();
		if (txCount) {
			RedisService.setString(REDIS_KEY.TRANSACTIONS_COUNT, txCount);
		}
	}

	async circulateSupplyCron() {
		const circulateSupplyFigure: any = await RedisService.getString(
			REDIS_KEY.CIRCULATING_SUPPLY_FIGURE,
		);
		console.log('circulateSupplyCron', circulateSupplyFigure);
		const staticCirculatingValue = STATIC_CIRCULATING_SUPPLY_FIGURE;

		if (circulateSupplyFigure) {
			console.log('circulateSupplyFigure', circulateSupplyFigure);

			const latestCirculatingSupply =
				circulateSupplyFigure + INCREMENT_SUPPLY_BY;
			console.log('latestCirculatingSupply', latestCirculatingSupply);

			await RedisService.setString(
				REDIS_KEY.CIRCULATING_SUPPLY_FIGURE,
				latestCirculatingSupply,
			);
		} else {
			console.log(
				'latestCirculatingSupply',
				staticCirculatingValue + INCREMENT_SUPPLY_BY,
			);

			await RedisService.setString(
				REDIS_KEY.CIRCULATING_SUPPLY_FIGURE,
				staticCirculatingValue + INCREMENT_SUPPLY_BY,
			);
		}
		return true;
	}
}
export default new ProcessHelper();
